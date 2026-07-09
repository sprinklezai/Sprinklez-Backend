const express = require("express");
const router = express.Router();

const { getData } = require("../services/excelService");

router.get("/brand/:brandCode", (req, res) => {
  try {
    const brandCode = String(req.params.brandCode || "").trim().toUpperCase();

    const brands = getData("brands");
    const stores = getData("stores");
    const countries = getData("countries");
    const companies = getData("companies");

    const normalize = (value) => String(value || "").trim().toUpperCase();

    const countryLookup = new Map(
      countries.map((country) => [
        normalize(country.country_code),
        country.country_name || normalize(country.country_code),
      ])
    );

    const companyLookup = new Map(
      companies.map((company) => [
        normalize(company.company_code),
        company.company_name || normalize(company.company_code),
      ])
    );

    const brand = brands.find(
      (item) => normalize(item.brand_code) === brandCode
    );

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const rawBrandStores = stores.filter(
      (store) => normalize(store.brand_code) === brandCode
    );

    const brandStores = rawBrandStores.map((store) => {
      const countryCode = normalize(store.country_code);
      const companyCode = normalize(store.company_code);

      return {
        ...store,
        country_code: countryCode,
        country_name: countryLookup.get(countryCode) || countryCode,
        company_code: companyCode,
        company_name: companyLookup.get(companyCode) || companyCode,
      };
    });

    const activeStores = brandStores.filter((store) => {
      const status = String(store.status || "").trim().toLowerCase();
      return status === "yes" || status === "active";
    }).length;

    const inactiveStores = brandStores.filter((store) => {
      const status = String(store.status || "").trim().toLowerCase();
      return status === "no" || status === "inactive";
    }).length;

    const countryMap = new Map();
    const companyMap = new Map();

    brandStores.forEach((store) => {
      if (store.country_code) {
        countryMap.set(store.country_code, {
          country_code: store.country_code,
          country_name: store.country_name,
          stores:
            (countryMap.get(store.country_code)?.stores || 0) + 1,
        });
      }

      if (store.company_code) {
        companyMap.set(store.company_code, {
          company_code: store.company_code,
          company_name: store.company_name,
          stores:
            (companyMap.get(store.company_code)?.stores || 0) + 1,
        });
      }
    });

    const countrySummary = Array.from(countryMap.values()).sort(
      (a, b) => b.stores - a.stores
    );

    const companySummary = Array.from(companyMap.values()).sort(
      (a, b) => b.stores - a.stores
    );

    res.json({
      success: true,
      brand: {
        brand_code: brandCode,
        brand_name: brand.brand_name || brand.brand_desc || brandCode,
        brand_desc: brand.brand_desc || "",
      },
      kpis: {
        stores: brandStores.length,
        countries: countrySummary.length,
        companies: companySummary.length,
        activeStores,
        inactiveStores,
      },
      stores: brandStores,
      countrySummary,
      companySummary,
    });
  } catch (error) {
    console.error("Brand API error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load brand data",
    });
  }
});

module.exports = router;