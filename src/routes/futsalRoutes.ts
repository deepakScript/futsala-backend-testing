import express from "express";
import { getAllVenues, getVenueById, searchVenues } from "../controllers/futsalController";


const router = express.Router();

router.get("/", getAllVenues);
router.get("/search-venue", searchVenues);
router.get("/:id", getVenueById);

export default router;
