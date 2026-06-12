import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { useStudent } from "../../context/StudentContext";

const pageWrap = {
  padding: 24,
  maxWidth: 1200,
};

const panel = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  backgroundColor: "#ffffff",
  boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
};

const StudentFinanceCards = () => {
  const { selectedStudentId } = useStudent();
  const [cards, setCards] = useState([]);
  const [myClass, setMyClass] = useState("");
  const [loading, setLoading] = useState(true);

  const downloadClassFeeCsv = (card) => {
    if (!card) return;
    const rows = [
      ["Fee Type", "Amount"],
      ["Class Name", card.class_name],
      ["Registration Fee", `₹${card.registration_fee}`],
      ["Admission Fee", `₹${card.admission_fee}`],
      ["Tuition Fee", `₹${card.tuition_fee}`],
      ["Computer Fee", `₹${card.computer_fee}`],
      ["Annual Charges", `₹${card.annual_charges}`],
      ["Science Fee", `₹${card.science_fee}`],
      ["Sports Fee", `₹${card.sports_fee}`],
      ["Total Fee", `₹${card.total_fee}`]
    ];

    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fee_structure_${card.class_name.replace(/\s+/g, "_")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadAllFeeCardsCsv = () => {
    if (!cards.length) return;
    const rows = [
      ["Class Name", "Registration Fee", "Admission Fee", "Tuition Fee", "Computer Fee", "Annual Charges", "Science Fee", "Sports Fee", "Total Fee"]
    ];
    cards.forEach((row) => {
      rows.push([
        row.class_name,
        `₹${row.registration_fee}`,
        `₹${row.admission_fee}`,
        `₹${row.tuition_fee}`,
        `₹${row.computer_fee}`,
        `₹${row.annual_charges}`,
        `₹${row.science_fee}`,
        `₹${row.sports_fee}`,
        `₹${row.total_fee}`
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
    a.download = "all_classes_fee_structures.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setLoading(true);
    api
      .get("fees/my/class-fee-cards/")
      .then((res) => {
        setCards(res.data?.cards || []);
        setMyClass(res.data?.student_class_name || "");
      })
      .catch(() => {
        setCards([]);
        setMyClass("");
      })
      .finally(() => setLoading(false));
  }, [selectedStudentId]);

  if (loading)
    return (
      <div className="dashboard-shell" style={{ padding: 24, color: "#6b7280" }}>
        Loading finance cards...
      </div>
    );

  const normalizeClassLabel = (value) => {
    const raw = String(value || "")
      .trim()
      .toLowerCase();
    if (!raw) return "";
    const numberMatch = raw.match(/\d+/);
    if (numberMatch) return numberMatch[0];
    if (raw.includes("nursery")) return "nursery";
    if (raw === "lkg" || raw.includes("lkg")) return "lkg";
    if (raw === "ukg" || raw.includes("ukg")) return "ukg";
    return raw.replace(/\s+/g, "");
  };

  const myClassKey = normalizeClassLabel(myClass);
  const myCard = cards.find(
    (row) => myClassKey && normalizeClassLabel(row.class_name) === myClassKey,
  );

  return (
    <div
      style={{
        ...pageWrap,
        background: "#f8fafc",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <style>
        {`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-up { animation: fadeIn 0.4s ease forwards; }
                .fee-table-row:hover { background-color: #f1f5f9 !important; }
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
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
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
              Class-wise Fees Card
            </h1>
            <p
              style={{
                margin: "8px 0 0",
                color: "#64748b",
                fontWeight: 900,
                fontSize: "15px",
              }}
            >
              View and compare fee structures across all classes.{" "}
              {myClass ? `Your current class is ${myClass}.` : ""}
            </p>
          </div>
        </div>
      </div>

      {myCard ? (
        <div
          style={{
            ...panel,
            borderColor: "#bfdbfe",
            background: "linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)",
            padding: 18,
            maxWidth: 620,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>
              {myCard.class_name}
            </h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => downloadClassFeeCsv(myCard)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #2563eb",
                  backgroundColor: "#2563eb",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Download CSV
              </button>
              <span
                style={{
                  backgroundColor: "#1d4ed8",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Your Class
              </span>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              fontSize: 14,
              color: "#1f2937",
            }}
          >
            <div>Registration Fee</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
              ₹{myCard.registration_fee}
            </div>
            <div>Admission Fee</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
              ₹{myCard.admission_fee}
            </div>
            <div>Tuition Fee</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
              ₹{myCard.tuition_fee}
            </div>
            <div>Computer Fee</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
              ₹{myCard.computer_fee}
            </div>
            <div>Annual Charges</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
              ₹{myCard.annual_charges}
            </div>
            <div>Science Fee</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
              ₹{myCard.science_fee}
            </div>
            <div>Sports Fee</div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>
              ₹{myCard.sports_fee}
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid #cbd5e1",
              fontWeight: 800,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 18,
              color: "#0f172a",
            }}
          >
            <span>Total Fee</span>
            <span>₹{myCard.total_fee}</span>
          </div>
        </div>
      ) : (
        <div
          style={{
            ...panel,
            marginTop: 14,
            padding: 14,
            color: "#6b7280",
            fontSize: 14,
          }}
        >
          Your class fee card is not available yet. Please contact the admin
          office.
        </div>
      )}

      <div style={{ ...panel, marginTop: 18, padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h3 style={{ margin: 0, color: "#111827" }}>All Fee Cards</h3>
          <button
            type="button"
            onClick={downloadAllFeeCardsCsv}
            style={{
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              backgroundColor: "#fff",
              color: "#111827",
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Export CSV
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div className="table-scroll"><table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6" }}>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Class Name
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Registration
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Admission
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Tuition
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Computer
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Annual
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Science
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Sports
                </th>
                <th style={{ textAlign: "left", padding: 10, fontSize: 13 }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {cards.map((row) => (
                <tr
                  key={row.id}
                  style={{
                    borderTop: "1px solid #eef2f7",
                    backgroundColor:
                      normalizeClassLabel(row.class_name) === myClassKey
                        ? "#f8fbff"
                        : "#fff",
                  }}
                >
                  <td
                    style={{ padding: 10, fontWeight: 700, color: "#111827" }}
                  >
                    {row.class_name}
                  </td>
                  <td style={{ padding: 10 }}>₹{row.registration_fee}</td>
                  <td style={{ padding: 10 }}>₹{row.admission_fee}</td>
                  <td style={{ padding: 10 }}>₹{row.tuition_fee}</td>
                  <td style={{ padding: 10 }}>₹{row.computer_fee}</td>
                  <td style={{ padding: 10 }}>₹{row.annual_charges}</td>
                  <td style={{ padding: 10 }}>₹{row.science_fee}</td>
                  <td style={{ padding: 10 }}>₹{row.sports_fee}</td>
                  <td
                    style={{ padding: 10, fontWeight: 800, color: "#111827" }}
                  >
                    ₹{row.total_fee}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
      {cards.length === 0 && (
        <p style={{ color: "#6b7280", marginTop: 12 }}>
          Fee cards have not been uploaded yet. Please contact the admin office.
        </p>
      )}
    </div>
  );
};

export default StudentFinanceCards;
