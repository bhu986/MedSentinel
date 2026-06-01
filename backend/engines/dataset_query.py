import re
import json
import traceback
import pandas as pd
import numpy as np
import utils
import groq_client

logger = utils.setup_logger("dataset_query")

SAFE_GLOBALS = {
    "__builtins__": {
        "len": len, "range": range, "enumerate": enumerate, "zip": zip,
        "list": list, "dict": dict, "str": str, "int": int, "float": float,
        "bool": bool, "round": round, "abs": abs, "min": min, "max": max,
        "sorted": sorted, "print": print, "isinstance": isinstance,
        "any": any, "all": all, "sum": sum,
    },
    "pd": pd, "np": np,
}

def build_system_prompt(columns, dtypes, sample_rows, row_count):
    col_info = "\n".join([f"  - {col} ({dtypes.get(col, 'object')})" for col in columns])
    sample_str = json.dumps(sample_rows[:3], indent=2, default=str)
    return f"""You are a senior Python/Pandas clinical data analyst.

Dataset: {row_count} rows.

COLUMNS:
{col_info}

SAMPLE DATA (first 3 rows):
{sample_str}

TASK: Write Python/Pandas code that answers the user question.
The DataFrame is already loaded as `df`. Store the final answer in `result` (must be a DataFrame).

CRITICAL RULES — FOLLOW EXACTLY:
1. result must be a pandas DataFrame always.
2. Use ONLY pd and np — no imports.
3. ALWAYS wrap every comparison in its own parentheses before using & or |.
   CORRECT:   df[(df['a'] > 10) & (df['b'] < 5)]
   WRONG:     df[df['a'] > 10 & df['b'] < 5]
   WRONG:     df[df['a'] > 10 | df['b'] < 5]
4. For OR conditions between comparisons ALWAYS use: (cond1) | (cond2)
5. For AND conditions between comparisons ALWAYS use: (cond1) & (cond2)
6. For string columns: use .astype(str).str.lower().isin([...]) for membership.
7. Handle NaN: use .dropna(subset=[...]) or pd.to_numeric(col, errors='coerce').
8. For groupby aggregation returning multiple stats use .agg([...]).reset_index().
9. If result would be a dict or scalar, wrap it in pd.DataFrame([dict]) or pd.DataFrame({{'value':[scalar]}}).
10. No explanations — output ONLY raw Python code. No markdown. No backticks.
11. Max 20 lines.
12. CRITICAL PANDAS SYNTAX: When combining multiple boolean conditions, you MUST wrap every individual condition in parentheses to prevent bitwise evaluation errors.

EXAMPLE of correct multi-condition filter:
abnormal = ['afib', 'svt', 'pvc']
df['rhythm_lower'] = df['rhythm'].astype(str).str.lower()
filtered = df[
    (df['rhythm_lower'].isin(abnormal)) &
    ((df['heart_rate_bpm'] > 100) | (df['heart_rate_bpm'] < 50)) &
    (df['noise_level'] < 0.5)
].dropna(subset=['qt_interval_ms'])
result = filtered[['patient_id','heart_rate_bpm','rhythm','qt_interval_ms']].copy()
"""

def clean_code_output(raw):
    code = re.sub(r"```python", "", raw, flags=re.IGNORECASE)
    code = re.sub(r"```", "", code)
    return code.strip()

def dataframe_to_records(obj):
    """Convert whatever `result` is into a list of dicts safely handling Numpy types."""
    if isinstance(obj, pd.DataFrame):
        # to_json automatically handles numpy int64, float64, and NaN values perfectly
        json_str = obj.to_json(orient="records", date_format="iso")
        return json.loads(json_str)
    
    elif isinstance(obj, (list, dict)):
        # If the AI returned a list or dict, forcefully convert it via pandas to clean types
        if isinstance(obj, dict):
            obj = [obj]
        json_str = pd.DataFrame(obj).to_json(orient="records", date_format="iso")
        return json.loads(json_str)
        
    else:
        return [{"result": str(obj)}]

def process_dataset_query(question, columns, rows):
    if not question or not question.strip():
        return {"error": "Question cannot be empty."}
    if not columns or not rows:
        return {"error": "No dataset provided. Please upload a dataset first."}

    # Reconstruct DataFrame
    try:
        df = pd.DataFrame(rows, columns=columns)
        for col in df.columns:
            try:
                df[col] = pd.to_numeric(df[col], errors="ignore")
            except Exception:
                pass
    except Exception as e:
        return {"error": f"Failed to reconstruct dataset: {str(e)}"}

    dtypes = {c: str(df[c].dtype) for c in df.columns}
    sample = (
        df.head(3)
        .replace([np.inf, -np.inf], np.nan)
        .where(pd.notnull(df.head(3)), None)
        .to_dict(orient="records")
    )

    system_prompt = build_system_prompt(df.columns.tolist(), dtypes, sample, len(df))
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": question},
    ]

    logger.info(f"Dataset query: {question[:80]}")
    raw = groq_client.groq_chat(
        messages, model=groq_client.MODEL_REASONING, temperature=0.0
    )
    if not raw:
        return {"error": "Groq returned no response. Check GROQ_API_KEY."}

    code = clean_code_output(raw)
    logger.info(f"Generated Pandas code:\n{code}")

    # Security check
    BLOCKED = ["import ", "open(", "exec(", "eval(", "__import__",
               "subprocess", "os.", "sys.", "shutil", "socket"]
    for pat in BLOCKED:
        if pat in code:
            return {"error": f"Security: blocked pattern '{pat}'.", "code_executed": code}

    # Execute safely
    local_vars = {"df": df.copy()}
    exec_globals = {**SAFE_GLOBALS, "df": df.copy()}

    try:
        exec(code, exec_globals, local_vars)  # noqa: S102
        result = local_vars.get("result", exec_globals.get("result"))

        if result is None:
            return {"error": "Code ran but `result` variable was never set.", "code_executed": code}

        # If result is a dict of DataFrames (multi-table), flatten to one
        if isinstance(result, dict):
            parts = []
            for key, val in result.items():
                if isinstance(val, pd.DataFrame):
                    val = val.copy()
                    val.insert(0, "_section", key)
                    parts.append(val)
                else:
                    parts.append(pd.DataFrame([{"_section": key, "value": str(val)}]))
            if parts:
                result = pd.concat(parts, ignore_index=True)
            else:
                result = pd.DataFrame([{"result": str(result)}])

        records = dataframe_to_records(result)
        return {"data": records, "row_count": len(records), "code_executed": code}

    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"Execution error:\n{tb}")
        return {"error": f"Execution error: {str(e)}", "code_executed": code, "traceback": tb}