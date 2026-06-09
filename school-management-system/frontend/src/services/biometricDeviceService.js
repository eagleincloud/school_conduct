import api, { BASE_URL } from "./api";

const biometricDeviceService = {
  list: async (params = {}) => {
    const response = await api.get("attendance/devices/", { params });
    return response.data || [];
  },

  create: async (payload) => {
    const response = await api.post("attendance/devices/", payload);
    return response.data;
  },

  update: async (deviceId, payload) => {
    const response = await api.patch(`attendance/devices/${deviceId}/`, payload);
    return response.data;
  },

  remove: async (deviceId) => {
    await api.delete(`attendance/devices/${deviceId}/`);
  },

  probeConnection: async (payload) => {
    const response = await api.post("attendance/devices/test-connection/", payload);
    return response.data;
  },

  testDevice: async (deviceId) => {
    const response = await api.post(`attendance/devices/${deviceId}/test/`);
    return response.data;
  },

  rotateSecret: async (deviceId) => {
    const response = await api.post(`attendance/devices/${deviceId}/rotate-secret/`);
    return response.data;
  },

  getBridgePreview: async (deviceId) => {
    const response = await api.get(`attendance/devices/${deviceId}/bridge-preview/`);
    return response.data;
  },

  launchBridges: async (payload = {}) => {
    const response = await api.post("attendance/devices/launch-bridges/", payload);
    return response.data;
  },

  createStatusStream: ({ school } = {}) => {
    const token = localStorage.getItem("access_token");
    const url = new URL(`${BASE_URL}attendance/devices/status-stream/`, window.location.origin);
    if (token) {
      url.searchParams.set("token", token);
    }
    if (school) {
      url.searchParams.set("school", school);
    }
    return new EventSource(url.toString());
  },

  downloadConfig: async (deviceId) => {
    const response = await api.get(`attendance/devices/${deviceId}/config/`, {
      responseType: "blob",
    });
    return response;
  },
};

export default biometricDeviceService;
