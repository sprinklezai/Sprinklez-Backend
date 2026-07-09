const express = require("express");
const router = express.Router();

const { getData } = require("../services/excelService");

router.get("/overview", (req, res) => {
  try {
    const brands = getData("brands");
    const companies = getData("companies");
    const countries = getData("countries");
    const stores = getData("stores");
    const employees = getData("employee");

    const normalize = (value) => String(value || "").trim().toUpperCase();

    const activeStores = stores.filter((store) => {
      const status = String(store.status || "").trim().toLowerCase();
      return status === "yes" || status === "active";
    }).length;

    const inactiveStores = stores.filter((store) => {
      const status = String(store.status || "").trim().toLowerCase();
      return status === "no" || status === "inactive";
    }).length;

    const brandSummary = brands.map((brand) => {
      const brandCode = normalize(brand.brand_code);

      const brandStores = stores.filter(
        (store) => normalize(store.brand_code) === brandCode
      );

      const uniqueCountries = new Set(
        brandStores
          .map((store) => normalize(store.country_code))
          .filter(Boolean)
      );

      return {
        brand_code: brandCode,
        brand_name: brand.brand_name || brand.brand_desc || brandCode,
        brand_desc: brand.brand_desc || "",
        stores: brandStores.length,
        countries: uniqueCountries.size,
      };
    });

    const topBrandsByStores = [...brandSummary].sort(
      (a, b) => b.stores - a.stores
    );

    const countrySummary = countries.map((country) => {
      const countryCode = normalize(country.country_code);

      const countryStores = stores.filter(
        (store) => normalize(store.country_code) === countryCode
      );

      return {
        country_code: countryCode,
        country_name: country.country_name || countryCode,
        stores: countryStores.length,
      };
    });

    const companySummary = companies.map((company) => {
      const companyCode = normalize(company.company_code);

      const companyStores = stores.filter(
        (store) => normalize(store.company_code) === companyCode
      );

      return {
        company_code: companyCode,
        company_name: company.company_name || companyCode,
        stores: companyStores.length,
      };
    });

    res.json({
      success: true,
      kpis: {
        stores: stores.length,
        brands: brands.length,
        companies: companies.length,
        countries: countries.length,
        employees: employees.length,
        activeStores,
        inactiveStores,
      },
      brandSummary,
      topBrandsByStores,
      countrySummary,
      companySummary,
    });
  } catch (error) {
    console.error("Overview API error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load overview data",
    });
  }
});

module.exports = router;