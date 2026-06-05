import React, { useEffect, useState } from "react";
import api from "../../services/api";

const Timetable = () => {
  const [timetable, setTimetable] = useState([]);

  useEffect(() => {
    api.get("timetable/").then((res) => setTimetable(res.data));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Weekly Timetable</h1>
      <div className="table-scroll"><table
        border="1"
        cellPadding="10"
        style={{ width: "100%", borderCollapse: "collapse" }}
      >
        <thead>
          <tr>
            <th>Day</th>
            <th>Time</th>
            <th>Subject</th>
          </tr>
        </thead>
        <tbody>
          {timetable.map((t) => (
            <tr key={t.id}>
              <td>{t.day}</td>
              <td>
                {t.start_time} - {t.end_time}
              </td>
              <td>{t.subject}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {timetable.length === 0 && <p>Timetable not scheduled yet.</p>}
    </div>
  );
};

export default Timetable;
