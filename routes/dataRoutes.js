const express = require("express");
const router = express.Router();

const { getData } = require("../services/excelService");

router.get("/:type", (req, res) => {
    try {
        const { type } = req.params;

        const data = getData(type);

        res.json({
            success: true,
            type,
            count: data.length,
            data
        });

    } catch (err) {
        res.status(400).json({
            success: false,
            error: err.message
        });
    }
});

module.exports = router;