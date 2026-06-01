import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Import explicitly

// Helper to format the report text
const generateReportText = (metrics) => {
    const date = new Date().toLocaleString();
    return `
MEDSENTINEL AI - CLINICAL EXECUTIVE REPORT
Generated: ${date}
Dataset: ${metrics.datasetName || 'Active Dataset'}
--------------------------------------------------

1. EXECUTIVE SUMMARY
${metrics.executiveSummary || 'No summary available.'}

2. DATASET OVERVIEW & KPIs
Total Records: ${metrics.kpis?.totalRows || 'N/A'}
Total Columns: ${metrics.kpis?.totalCols || 'N/A'}
Overall Dataset Health Score: ${metrics.kpis?.healthScore || 'N/A'}%

3. ANOMALY FINDINGS
Total Anomalies Flagged: ${metrics.anomalies?.flagged || '0'}
Critical Threats (Score >= 70): ${metrics.anomalies?.critical || '0'}
Moderate Threats: ${metrics.anomalies?.moderate || '0'}

4. CLINICAL INSIGHTS & RECOMMENDATIONS
${metrics.recommendations || 'No recommendations generated.'}
  `.trim();
};

export const downloadReportTXT = (metrics) => {
    const content = generateReportText(metrics);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MedSentinel_Report_${new Date().getTime()}.txt`;
    link.click();
};

export const downloadReportPDF = (metrics) => {
    const doc = new jsPDF();
    const date = new Date().toLocaleString();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 212, 255); // MedSentinel Blue
    doc.text("MedSentinel AI - Clinical Executive Report", 14, 22);

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${date}`, 14, 30);
    doc.text(`Dataset: ${metrics.datasetName || 'Active Dataset'}`, 14, 35);

    // Section 1: Executive Summary
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("1. Executive Summary", 14, 48);
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(metrics.executiveSummary || 'N/A', 180);
    doc.text(summaryLines, 14, 55);

    let currentY = 55 + (summaryLines.length * 5) + 10;

    // Section 2: KPIs & Anomaly Stats
    doc.setFontSize(14);
    doc.text("2. Key Metrics & Anomalies", 14, currentY);

    // FIX: Call autoTable as a direct function instead of a method
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Metric', 'Value']],
        body: [
            ['Total Records', metrics.kpis?.totalRows || 'N/A'],
            ['Dataset Health Score', `${metrics.kpis?.healthScore || 'N/A'}%`],
            ['Total Anomalies Flagged', metrics.anomalies?.flagged || '0'],
            ['Critical Threats (Score >= 70)', metrics.anomalies?.critical || '0'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 212, 255] }
    });

    // Grab the Y position after the table renders
    currentY = doc.lastAutoTable.finalY + 15;

    // Section 3: Recommendations
    doc.setFontSize(14);
    doc.text("3. Clinical Recommendations", 14, currentY);
    doc.setFontSize(10);
    const recLines = doc.splitTextToSize(metrics.recommendations || 'N/A', 180);
    doc.text(recLines, 14, currentY + 7);

    // Save PDF
    doc.save(`MedSentinel_Report_${new Date().getTime()}.pdf`);
};