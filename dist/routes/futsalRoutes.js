"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const futsalController_1 = require("../controllers/futsalController");
const router = express_1.default.Router();
router.get("/", futsalController_1.getAllVenues);
router.get("/:id", futsalController_1.getVenueById);
router.get("/search-venue", futsalController_1.searchVenues);
exports.default = router;
