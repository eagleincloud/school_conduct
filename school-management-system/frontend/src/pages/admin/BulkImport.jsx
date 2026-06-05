import React, { useState, useEffect } from 'react';
import { useConfirm } from '../../context/ConfirmContext';
import api from '../../services/api';

const BulkImport = () => {
    const confirm = useConfirm();
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('student');
  const [validRows, setValidRows] = useState([]);
  const [errorRows, setErrorRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await api.get('bulk-upload/history/');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch history', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDeleteHistory = async (logId) => {
    if (!(await confirm("Are you sure you want to rollback and DELETE this specific batch of imported users? This cannot be undone."))) {
      return;
    }
    
    try {
      await api.delete(`bulk-upload/history/${logId}/`);
      alert("Successfully rolled back and deleted the batch.");
      fetchHistory();
    } catch (error) {
      alert("Failed to rollback: " + (error.response?.data?.error || error.message));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleValidate = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', importType);

    try {
      const response = await api.post('bulk-upload/validate/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setValidRows(response.data.valid_rows || []);
      setErrorRows(response.data.error_rows || []);
      setStep(2);
      alert('Validation complete');
    } catch (error) {
      const serverErrors = error.response?.data?.error_rows;
      if (serverErrors) {
        setErrorRows(serverErrors);
        setValidRows([]);
        setStep(2);
      } else {
        alert(error.response?.data?.error || error.message || 'An unexpected server error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (validRows.length === 0) {
      alert('No valid rows to import');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('bulk-upload/confirm/', {
        data: validRows,
        type: importType,
        file_name: file.name
      });
      setResult(response.data);
      setStep(3);
      alert('Import complete');
    } catch (error) {
      alert(error.response?.data?.error || 'Import failed');
    } finally {
      setLoading(false);
      fetchHistory(); // Refresh history immediately after a successful/failed import
    }
  };

  const resetForm = () => {
    setFile(null);
    setImportType('student');
    setValidRows([]);
    setErrorRows([]);
    setResult(null);
    setStep(1);
  };

  const downloadTemplate = () => {
    // A simple CSV string generation for the download template feature
    let csvContent = "";
    if (importType === 'student') {
      csvContent = "admission_no,name,username,email,class,section,roll_number,phone\nADM101,John Doe,johndoe,john@example.com,Class 1,A,101,1234567890";
    } else {
      csvContent = "employee_id,name,specialization,email,phone,gender,dob,qualification,experience_years,joining_date\nEMP01,Jane Smith,Mathematics,jane@example.com,1234567890,Female,1990-01-01,M.Sc.,5,2023-08-01";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${importType}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Bulk Import ({importType === 'student' ? 'Students' : 'Teachers'})</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Import Type</label>
              <select
                value={importType}
                onChange={(e) => setImportType(e.target.value)}
                className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="student">Students</option>
                <option value="teacher">Teachers</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel / CSV</label>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleValidate}
                disabled={!file || loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Validating...' : 'Validate File'}
              </button>
              <button
                onClick={downloadTemplate}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Download Template
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Validation Results</h2>
            
            <div className="grid grid-cols-1 gap-6">
              {/* Errors Section */}
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h3 className="text-lg font-medium text-red-800 mb-2">Errors ({errorRows.length})</h3>
                {errorRows.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-red-200">
                      <thead className="bg-red-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-200 bg-white">
                        {errorRows.map((err, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-red-900">{err.row}</td>
                            <td className="px-4 py-2 text-sm text-red-900">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-red-600">No errors found.</p>
                )}
              </div>

              {/* Valid Data Section */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="text-lg font-medium text-green-800 mb-2">Valid Rows ({validRows.length})</h3>
                {validRows.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto">
                    <table className="min-w-full divide-y divide-green-200">
                      <thead className="bg-green-100">
                        <tr>
                          {importType === 'student' && <th className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase">Admission No</th>}
                          {importType === 'teacher' && <th className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase">Employee ID</th>}
                          <th className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase">Name</th>
                          {importType === 'student' && <th className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase">Username</th>}
                          <th className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase">Email</th>
                          {importType === 'student' && <th className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase">Class - Section</th>}
                          {importType === 'teacher' && <th className="px-4 py-2 text-left text-xs font-medium text-green-700 uppercase">Specialization</th>}
                          <th className="px-4 py-2 text-right text-xs font-medium text-green-700 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-green-200 bg-white">
                        {validRows.slice(0, 50).map((row, idx) => (
                          <tr key={idx}>
                            {importType === 'student' && <td className="px-4 py-2 whitespace-nowrap text-sm text-green-900">{row.admission_no}</td>}
                            {importType === 'teacher' && <td className="px-4 py-2 whitespace-nowrap text-sm text-green-900">{row.employee_id}</td>}
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-green-900">{row.name}</td>
                            {importType === 'student' && <td className="px-4 py-2 whitespace-nowrap text-sm text-green-900">{row.username || row.email.split('@')[0]}</td>}
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-green-900">{row.email}</td>
                            {importType === 'student' && <td className="px-4 py-2 whitespace-nowrap text-sm text-green-900">{row.class} - {row.section}</td>}
                            {importType === 'teacher' && <td className="px-4 py-2 whitespace-nowrap text-sm text-green-900">{row.specialization}</td>}
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-right">
                              <button
                                onClick={() => {
                                  const newRows = [...validRows];
                                  newRows.splice(idx, 1);
                                  setValidRows(newRows);
                                }}
                                className="text-red-500 hover:text-red-700 font-bold px-2 py-1 bg-red-50 hover:bg-red-100 rounded"
                                title="Remove row"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validRows.length > 50 && <p className="mt-2 text-sm text-gray-500">Showing first 50 valid rows...</p>}
                  </div>
                ) : (
                  <p className="text-sm text-green-600">No valid rows found.</p>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t">
              <button
                onClick={handleConfirm}
                disabled={validRows.length === 0 || loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Importing...' : `Confirm Import (${validRows.length} rows)`}
              </button>
              <button
                onClick={resetForm}
                disabled={loading}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                {validRows.length === 0 ? 'Go Back' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-6 text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Import Successful</h2>
            <div className="max-w-sm mx-auto bg-gray-50 rounded-lg p-4 mt-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Total Valid Rows:</span>
                <span className="font-semibold text-gray-900">{validRows.length}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Successfully Imported:</span>
                <span className="font-semibold text-green-600">{result.success_count}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-600">Failed to Import:</span>
                <span className="font-semibold text-red-600">{result.failed_count}</span>
              </div>
            </div>
            <div className="pt-6">
              <button
                onClick={resetForm}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Import History Sidebar */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow p-6 h-fit max-h-[calc(100vh-200px)] flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Import History</h2>
          {loadingHistory ? (
            <p className="text-sm text-gray-500">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No import history found.</p>
          ) : (
            <div className="overflow-y-auto space-y-4 flex-1 pr-2">
              {history.map((log) => (
                <div key={log.id} className="bg-gray-50 border border-gray-200 rounded p-3 text-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-gray-700 truncate w-3/4" title={log.file_name}>{log.file_name}</span>
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{log.import_type}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div>Date: {new Date(log.created_at).toLocaleString()}</div>
                    <div>Imported: <span className="text-green-600 font-semibold">{log.success_count}</span> | Failed: <span className="text-red-600">{log.failed_count}</span></div>
                  </div>
                  <button
                    onClick={() => handleDeleteHistory(log.id)}
                    className="mt-2 text-xs w-full py-1.5 bg-red-50 text-red-600 font-semibold rounded border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    Rollback Upload
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImport;
