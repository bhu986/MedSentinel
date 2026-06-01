export const downloadCSV = (data, prefix = 'medsentinel_query') => {
    if (!data || data.length === 0) {
        console.warn("No data available to download.");
        return;
    }

    // Extract Headers
    const headers = Object.keys(data[0]);

    // Convert Data to CSV String
    const csvRows = data.map(row =>
        headers.map(header => {
            let cell = row[header] === null || row[header] === undefined ? '' : row[header];
            // Escape quotes and wrap in quotes if there are commas
            cell = cell.toString().replace(/"/g, '""');
            return `"${cell}"`;
        }).join(',')
    );

    const csvString = [headers.join(','), ...csvRows].join('\n');

    // Create Blob and Trigger Download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}_${timestamp}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};