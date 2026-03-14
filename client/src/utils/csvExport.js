/**
 * CSV Export Utility for StellarPay
 * Enables exporting employee payment data and vault transactions to CSV format
 */

/**
 * Convert array of objects to CSV string
 * @param {Array} data - Array of objects to convert
 * @param {Array} headers - Optional custom headers
 * @returns {string} CSV formatted string
 */
export function convertToCSV(data, headers = null) {
  if (!data || data.length === 0) {
    return '';
  }

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = csvHeaders.join(',');
  
  // Create data rows
  const dataRows = data.map(row => {
    return csvHeaders.map(header => {
      const value = row[header];
      
      // Handle values that contain commas or quotes
      if (value === null || value === undefined) {
        return '';
      }
      
      const stringValue = String(value);
      
      // Escape quotes and wrap in quotes if contains comma or quote
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file
 * @param {string} csvContent - CSV formatted string
 * @param {string} filename - Name of the file to download
 */
export function downloadCSV(csvContent, filename = 'export.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Create download link
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up URL
    URL.revokeObjectURL(url);
  }
}

/**
 * Export employee payment data to CSV
 * @param {Array} employees - Array of employee objects
 * @param {string} filename - Optional filename
 */
export function exportEmployeePayments(employees, filename = null) {
  if (!employees || employees.length === 0) {
    throw new Error('No employee data to export');
  }
  
  // Format employee data for CSV
  const formattedData = employees.map(emp => ({
    'Employee ID': emp.id,
    'Employee Name': emp.name,
    'Wallet Address': emp.walletAddress,
    'Monthly Salary (XLM)': emp.salary,
    'Withdrawn (XLM)': emp.withdrawn,
    'Remaining (XLM)': emp.salary - emp.withdrawn,
    'Status': emp.status,
    'Utilization %': ((emp.withdrawn / emp.salary) * 100).toFixed(2),
  }));
  
  const csvContent = convertToCSV(formattedData);
  const defaultFilename = `employee_payments_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, filename || defaultFilename);
}

/**
 * Export vault transaction summary to CSV
 * @param {Object} vaultData - Vault summary data
 * @param {string} filename - Optional filename
 */
export function exportVaultSummary(vaultData, filename = null) {
  if (!vaultData) {
    throw new Error('No vault data to export');
  }
  
  const summaryData = [
    {
      'Metric': 'Current Vault Balance',
      'Value': `${vaultData.balance} XLM`,
    },
    {
      'Metric': 'Total Payroll',
      'Value': `${vaultData.totalPayroll} XLM`,
    },
    {
      'Metric': 'Total Withdrawn',
      'Value': `${vaultData.totalWithdrawn} XLM`,
    },
    {
      'Metric': 'Remaining Payroll',
      'Value': `${vaultData.totalPayroll - vaultData.totalWithdrawn} XLM`,
    },
    {
      'Metric': 'Active Employees',
      'Value': vaultData.activeEmployees,
    },
    {
      'Metric': 'Payroll Coverage',
      'Value': `${vaultData.coverage}%`,
    },
    {
      'Metric': 'Export Date',
      'Value': new Date().toISOString(),
    },
  ];
  
  const csvContent = convertToCSV(summaryData);
  const defaultFilename = `vault_summary_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, filename || defaultFilename);
}

/**
 * Export comprehensive payroll report
 * @param {Array} employees - Array of employee objects
 * @param {Object} vaultData - Vault summary data
 * @param {string} filename - Optional filename
 */
export function exportPayrollReport(employees, vaultData, filename = null) {
  if (!employees || !vaultData) {
    throw new Error('Incomplete data for payroll report');
  }
  
  // Create comprehensive report
  const reportLines = [];
  
  // Header section
  reportLines.push('StellarPay Payroll Report');
  reportLines.push(`Generated: ${new Date().toLocaleString()}`);
  reportLines.push('');
  
  // Vault summary
  reportLines.push('VAULT SUMMARY');
  reportLines.push(`Current Balance,${vaultData.balance} XLM`);
  reportLines.push(`Total Payroll,${vaultData.totalPayroll} XLM`);
  reportLines.push(`Total Withdrawn,${vaultData.totalWithdrawn} XLM`);
  reportLines.push(`Active Employees,${vaultData.activeEmployees}`);
  reportLines.push(`Payroll Coverage,${vaultData.coverage}%`);
  reportLines.push('');
  
  // Employee details
  reportLines.push('EMPLOYEE PAYMENT DETAILS');
  reportLines.push('Employee ID,Employee Name,Wallet Address,Monthly Salary (XLM),Withdrawn (XLM),Remaining (XLM),Status,Utilization %');
  
  employees.forEach(emp => {
    reportLines.push(
      `${emp.id},${emp.name},${emp.walletAddress},${emp.salary},${emp.withdrawn},${emp.salary - emp.withdrawn},${emp.status},${((emp.withdrawn / emp.salary) * 100).toFixed(2)}%`
    );
  });
  
  const csvContent = reportLines.join('\n');
  const defaultFilename = `payroll_report_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCSV(csvContent, filename || defaultFilename);
}

export default {
  convertToCSV,
  downloadCSV,
  exportEmployeePayments,
  exportVaultSummary,
  exportPayrollReport,
};
