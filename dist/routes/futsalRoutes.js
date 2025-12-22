"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const futsalController_1 = require("../controllers/futsalController");
const router = (0, express_1.Router)();
router.get("/venue", futsalController_1.getAllVenues);
router.get("/venue-search", futsalController_1.searchVenues);
router.get("/venue/:id", futsalController_1.getVenueById);
exports.default = router;
