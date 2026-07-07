import api from "./api";

export async function getBrandDashboard(brandCode: string) {
  const response = await api.get(`/brand/${brandCode}`);
  return response.data;
}