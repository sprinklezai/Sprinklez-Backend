import api from "./api";

export async function getBrands() {
  const response = await api.get("/brands");
  return response.data.data || response.data;
}

export async function getCompanies() {
  const response = await api.get("/companies");
  return response.data.data || response.data;
}

export async function getCountries() {
  const response = await api.get("/countries");
  return response.data.data || response.data;
}

export async function getStores() {
  const response = await api.get("/stores");
  return response.data.data || response.data;
}

export async function getEmployees() {
  const response = await api.get("/employee");
  return response.data.data || response.data;
}