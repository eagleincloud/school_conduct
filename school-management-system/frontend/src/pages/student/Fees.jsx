import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const card = {
  backgroundColor: "#fff",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  padding: "18px",
  boxShadow: "0 1px 6px rgba(16,24,40,0.06)",
};

const Fees = () => {
  const { selectedStudentId } = useStudent();
  const [feeRecords, setFeeRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentForms, setPaymentForms] = useState({});
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .get("fees/my/")
      .then((res) => setFeeRecords(res.data || []))
      .catch(() => setFeeRecords([]))
      .finally(() => setLoading(false));
  }, [selectedStudentId]);

  useEffect(() => {
    const init = {};
    (feeRecords || []).forEach((r) => {
      const due = Number(r.due_amount || 0);
      init[r.id] = {
        amount: due > 0 ? due.toFixed(2) : "",
        payment_date: new Date().toISOString().slice(0, 10),
        payment_mode: "UPI",
        transaction_id: "",
      };
    });
    setPaymentForms(init);
  }, [feeRecords]);

  const setFormField = (recordId, field, value) => {
    setPaymentForms((prev) => ({
      ...prev,
      [recordId]: {
        ...(prev[recordId] || {}),
        [field]: value,
      },
    }));
  };

  const downloadReceipt = async (paymentId) => {
    try {
      const res = await api.get(`fees/my/receipt/${paymentId}/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `fee_receipt_${paymentId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (_) {
      alert("Could not download receipt.");
    }
  };

  const downloadLedgerCsv = (record) => {
    const rows = [];
    rows.push(["Date", "Particulars", "Debit", "Credit", "Balance"]);

    const payments = (record.payments || [])
      .slice()
      .sort((a, b) =>
        String(a.payment_date || "").localeCompare(
          String(b.payment_date || ""),
        ),
      );

    const totalFees = Number(record.total_fees || 0);
    let runningPaid = 0;

    rows.push([
      record.due_date || "",
      "Fee Charged",
      String(record.total_fees || 0),
      "",
      String(record.total_fees || 0),
    ]);

    payments.forEach((p) => {
      const credit = Number(p.amount || 0);
      runningPaid += credit;
      const balance = Math.max(totalFees - runningPaid, 0);
      rows.push([
        p.payment_date || "",
        `Payment (${p.payment_mode || ""})`,
        "",
        String(p.amount || 0),
        balance.toFixed(2),
      ]);
    });

    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student_ledger_${record.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const payNow = async (record) => {
    const form = paymentForms[record.id] || {};
    const amount = Number(form.amount || 0);
    const due = Number(record.due_amount || 0);

    if (!amount || amount <= 0) {
      alert("Please enter valid amount.");
      return;
    }
    if (amount - due > 0.009) {
      alert(`Amount cannot be greater than due (₹${record.due_amount}).`);
      return;
    }
    if (!form.payment_date) {
      alert("Please select payment date.");
      return;
    }

    setPayingId(record.id);
    try {
      const payload = {
        student_fee_id: record.id,
        amount: String(amount),
        payment_date: form.payment_date,
        payment_mode: form.payment_mode || "UPI",
        transaction_id: form.transaction_id || "",
      };
      const res = await api.post("fees/my/pay/", payload);
      const updated = res?.data?.student_fee;
      if (updated) {
        setFeeRecords((prev) =>
          prev.map((r) => (r.id === record.id ? updated : r)),
        );
        const nextDue = Number(updated.due_amount || 0);
        setPaymentForms((prev) => ({
          ...prev,
          [record.id]: {
            amount: nextDue > 0 ? nextDue.toFixed(2) : "",
            payment_date: new Date().toISOString().slice(0, 10),
            payment_mode: "UPI",
            transaction_id: "",
          },
        }));
      }
      alert("Payment recorded successfully. Receipt is now available below.");
    } catch (e) {
      alert(e?.response?.data?.error || "Could not process payment.");
    } finally {
      setPayingId(null);
    }
  };

  if (loading)
    return (
      <div style={{ padding: "20px", color: "#6b7280" }}>
        Loading fee status…
      </div>
    );

  const totals = (feeRecords || []).reduce(
    (acc, r) => {
      acc.total += Number(r.total_fees || 0);
      acc.paid += Number(r.amount_paid || 0);
      acc.due += Number(r.due_amount || 0);
      if (r.overdue && r.status !== "paid") acc.overdueCount += 1;
      return acc;
    },
    { total: 0, paid: 0, due: 0, overdueCount: 0 },
  );

  return (
    <div
      style={{
        padding: "24px",
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
                .fee-card { transition: all 0.2s ease; }
                .fee-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
                `}
      </style>

      {/* Premium Header Card */}
      <div
        className="animate-up"
        style={{
          backgroundColor: "#fff",
          padding: "28px",
          borderRadius: "24px",
          marginBottom: "20px",
          boxShadow: "0 1px 12px rgba(16,24,40,0.08)",
          border: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #fff 0%, #f8fafc 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 200,
            height: 200,
            background: "rgba(37, 99, 235, 0.03)",
            borderRadius: "50%",
            zIndex: 0,
          }}
        ></div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontWeight: 1000,
              fontSize: "32px",
              letterSpacing: "-0.02em",
              background: "linear-gradient(90deg, #1e293b 0%, #2563eb 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Fee Status
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              color: "#64748b",
              fontWeight: 900,
              fontSize: "15px",
            }}
          >
            Track your academic investments, view payment receipts, and manage
            your balance.
          </p>
        </div>
      </div>

      <div
        className="rg-autofit-sm" style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={card}>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Total Fees
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: totals.total > 0 ? 22 : 16,
              fontWeight: 900,
              color: totals.total > 0 ? "#111827" : "#94a3b8",
            }}
          >
            {totals.total > 0
              ? `₹${totals.total.toFixed(2)}`
              : "Fees Not Assigned"}
          </div>
        </div>
        <div style={card}>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Total Paid
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 22,
              fontWeight: 900,
              color: totals.paid > 0 ? "#166534" : "#94a3b8",
            }}
          >
            ₹{totals.paid.toFixed(2)}
          </div>
        </div>
        <div style={card}>
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Total Due
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: totals.due > 0 ? 22 : 18,
              fontWeight: 900,
              color: totals.due > 0 ? "#b45309" : "#166534",
            }}
          >
            {totals.due > 0 ? `₹${totals.due.toFixed(2)}` : "No Balance"}
          </div>
        </div>
        <div
          style={{
            ...card,
            borderColor: totals.overdueCount > 0 ? "#fecaca" : "#e5e7eb",
            backgroundColor: totals.overdueCount > 0 ? "#fff7ed" : "#fff",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#6b7280",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Overdue Records
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 22,
              fontWeight: 900,
              color: totals.overdueCount > 0 ? "#b91c1c" : "#111827",
            }}
          >
            {totals.overdueCount}
          </div>
        </div>
      </div>

      {totals.overdueCount > 0 ? (
        <div
          style={{
            marginBottom: "16px",
            border: "1px solid #fecaca",
            backgroundColor: "#fff7ed",
            color: "#991b1b",
            borderRadius: 12,
            padding: "10px 12px",
            fontWeight: 900,
          }}
        >
          You have overdue fee record(s). Please contact the office or pay as
          soon as possible.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {feeRecords.map((f) => {
          const overdue = f.overdue && f.status !== "paid";
          const ledgerRows = (f.payments || [])
            .slice()
            .sort((a, b) =>
              String(a.payment_date || "").localeCompare(
                String(b.payment_date || ""),
              ),
            );
          let runningPaid = 0;
          const totalFees = Number(f.total_fees || 0);
          return (
            <div
              key={f.id}
              style={{ ...card, borderColor: overdue ? "#fecaca" : "#e5e7eb" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: "18px" }}>
                    Fee record #{f.id}
                  </h2>
                  <div style={{ color: "#6b7280", fontSize: "13px" }}>
                    {f.class_display}
                  </div>
                </div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 900,
                    backgroundColor:
                      f.status === "paid"
                        ? "#dcfce7"
                        : f.status === "partial"
                          ? "#fef9c3"
                          : "#fee2e2",
                    color:
                      f.status === "paid"
                        ? "#166534"
                        : f.status === "partial"
                          ? "#854d0e"
                          : "#991b1b",
                  }}
                >
                  {f.status?.toUpperCase()}
                  {overdue ? " · OVERDUE" : ""}
                </span>
              </div>

              <div
                className="rg-autofit-sm" style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6b7280",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Total fees
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 900 }}>
                    ₹{f.total_fees}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6b7280",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Paid
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 900,
                      color: "#166534",
                    }}
                  >
                    ₹{f.amount_paid}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6b7280",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Due
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 900,
                      color: "#b45309",
                    }}
                  >
                    ₹{f.due_amount}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6b7280",
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    Due date
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 800 }}>
                    {f.due_date}
                  </div>
                </div>
              </div>

              {f.fee_breakdown && (
                <div
                  style={{
                    marginTop: "12px",
                    fontSize: "12px",
                    color: "#4b5563",
                  }}
                >
                  Tuition ₹{f.fee_breakdown.tuition_fees} · Exam ₹
                  {f.fee_breakdown.exam_fees} · Other ₹
                  {f.fee_breakdown.other_charges}
                </div>
              )}

              {Number(f.due_amount || 0) > 0 ? (
                <div
                  style={{
                    marginTop: "16px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: "#f9fafb",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 10 }}>
                    Pay Fees
                  </div>
                  <div
                    className="rg-autofit-sm" style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        Amount
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        max={f.due_amount}
                        step="0.01"
                        value={paymentForms[f.id]?.amount || ""}
                        onChange={(e) =>
                          setFormField(f.id, "amount", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                        }}
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        Payment date
                      </div>
                      <input
                        type="date"
                        value={paymentForms[f.id]?.payment_date || ""}
                        onChange={(e) =>
                          setFormField(f.id, "payment_date", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                        }}
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        Mode
                      </div>
                      <select
                        value={paymentForms[f.id]?.payment_mode || "UPI"}
                        onChange={(e) =>
                          setFormField(f.id, "payment_mode", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                        }}
                      >
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#6b7280",
                          fontWeight: 800,
                          marginBottom: 5,
                        }}
                      >
                        Transaction ID (optional)
                      </div>
                      <input
                        type="text"
                        value={paymentForms[f.id]?.transaction_id || ""}
                        onChange={(e) =>
                          setFormField(f.id, "transaction_id", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      disabled={payingId === f.id}
                      onClick={() => payNow(f)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "none",
                        backgroundColor: "#2563eb",
                        color: "#fff",
                        fontWeight: 900,
                        cursor: payingId === f.id ? "not-allowed" : "pointer",
                        opacity: payingId === f.id ? 0.75 : 1,
                      }}
                    >
                      {payingId === f.id ? "Processing..." : "Pay Now"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: "18px" }}>
                <div style={{ fontWeight: 900, marginBottom: "10px" }}>
                  Fees Receipt
                </div>
                {(f.payments || []).length === 0 ? (
                  <p style={{ color: "#6b7280", margin: 0 }}>
                    No payments yet.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <div className="table-scroll"><table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f2f4f7" }}>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Date
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Amount
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Mode
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Txn
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Receipt
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(f.payments || []).map((p) => (
                          <tr
                            key={p.id}
                            style={{ borderTop: "1px solid #eef2f7" }}
                          >
                            <td style={{ padding: "8px" }}>{p.payment_date}</td>
                            <td style={{ padding: "8px", fontWeight: 800 }}>
                              ₹{p.amount}
                            </td>
                            <td style={{ padding: "8px" }}>{p.payment_mode}</td>
                            <td style={{ padding: "8px" }}>
                              {p.transaction_id || "—"}
                            </td>
                            <td style={{ padding: "8px" }}>
                              <button
                                type="button"
                                onClick={() => downloadReceipt(p.id)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  border: "none",
                                  backgroundColor: "#6d28d9",
                                  color: "#fff",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                PDF
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: "18px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: "10px",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Student Ledger</div>
                  <button
                    type="button"
                    onClick={() => downloadLedgerCsv(f)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#fff",
                      color: "#111827",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Export CSV
                  </button>
                </div>
                {ledgerRows.length === 0 ? (
                  <p style={{ color: "#6b7280", margin: 0 }}>
                    No ledger entries yet.
                  </p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <div className="table-scroll"><table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr style={{ backgroundColor: "#f2f4f7" }}>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Date
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Particulars
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Debit
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Credit
                          </th>
                          <th style={{ padding: "8px", textAlign: "left" }}>
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderTop: "1px solid #eef2f7" }}>
                          <td style={{ padding: "8px" }}>
                            {f.due_date || "—"}
                          </td>
                          <td style={{ padding: "8px", fontWeight: 800 }}>
                            Fee Charged
                          </td>
                          <td style={{ padding: "8px", fontWeight: 800 }}>
                            ₹{f.total_fees}
                          </td>
                          <td style={{ padding: "8px" }}>—</td>
                          <td style={{ padding: "8px", fontWeight: 900 }}>
                            ₹{f.total_fees}
                          </td>
                        </tr>
                        {ledgerRows.map((p) => {
                          const credit = Number(p.amount || 0);
                          runningPaid += credit;
                          const balance = Math.max(totalFees - runningPaid, 0);
                          return (
                            <tr
                              key={`ledger-${p.id}`}
                              style={{ borderTop: "1px solid #eef2f7" }}
                            >
                              <td style={{ padding: "8px" }}>
                                {p.payment_date}
                              </td>
                              <td style={{ padding: "8px" }}>
                                Payment ({p.payment_mode})
                              </td>
                              <td style={{ padding: "8px" }}>—</td>
                              <td
                                style={{
                                  padding: "8px",
                                  fontWeight: 800,
                                  color: "#166534",
                                }}
                              >
                                ₹{p.amount}
                              </td>
                              <td style={{ padding: "8px", fontWeight: 900 }}>
                                ₹{balance.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {feeRecords.length === 0 && (
        <div
          style={{
            ...card,
            textAlign: "center",
            padding: "60px 20px",
            backgroundColor: "#f8fafc",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "20px", opacity: 0.5 }}>
            💳
          </div>
          <h3 style={{ margin: "0 0 8px", color: "#111827" }}>
            No Fees Assigned
          </h3>
          <p
            style={{
              margin: 0,
              color: "#64748b",
              fontSize: "14px",
              maxWidth: "300px",
              mx: "auto",
            }}
          >
            Your class fee structure hasn't been set by the administration yet.
            Please check back later.
          </p>
        </div>
      )}
    </div>
  );
};

export default Fees;
