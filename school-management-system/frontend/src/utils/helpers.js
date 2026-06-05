export const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const getStatusColor = (status) => {
  switch (status.toLowerCase()) {
    case "present":
      return "#28a745";
    case "absent":
      return "#dc3545";
    case "late":
      return "#ffc107";
    default:
      return "#6c757d";
  }
};
