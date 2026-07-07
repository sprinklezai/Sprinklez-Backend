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

    const brand = brands.find(
      (item) => normalize(item.brand_code) === brandCode
    );

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    const brandStores = stores.filter(
      (store) => normalize(store.brand_code) === brandCode
    );

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
      const countryCode = normalize(store.country_code);
      const companyCode = normalize(store.company_code);

      if (countryCode) {
        countryMap.set(countryCode, (countryMap.get(countryCode) || 0) + 1);
      }

      if (companyCode) {
        companyMap.set(companyCode, (companyMap.get(companyCode) || 0) + 1);
      }
    });

    const countrySummary = Array.from(countryMap.entries()).map(
      ([country_code, stores]) => {
        const country = countries.find(
          (item) => normalize(item.country_code) === country_code
        );

        return {
          country_code,
          country_name: country?.country_name || country_code,
          stores,
        };
      }
    );

    const companySummary = Array.from(companyMap.entries()).map(
      ([company_code, stores]) => {
        const company = companies.find(
          (item) => normalize(item.company_code) === company_code
        );

        return {
          company_code,
          company_name: company?.company_name || company_code,
          stores,
        };
      }
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