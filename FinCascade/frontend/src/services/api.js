import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 15000,
});

export const getHealth = () => api.get("/health");
export const getEntities = () => api.get("/entities");
export const getNetwork = () => api.get("/network");
export const getScenarios = () => api.get("/scenarios");
export const getCurrentStress = () => api.get("/stress/current");
export const getScenarioComparison = () => api.get("/compare");
export const getVulnerability = (limit = 15) =>
  api.get(`/vulnerability?limit=${limit}`);

export const runPresetScenario = (name) =>
  api.get(`/simulate/preset/${encodeURIComponent(name)}`);

export const runCustomScenario = (payload) =>
  api.post("/simulate", payload);

export default api;
