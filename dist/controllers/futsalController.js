"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchVenues = exports.getVenueById = exports.getAllVenues = void 0;
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
/**
 * Get all futsal grounds
 * @route GET /
 */
const getAllVenues = async (req, res) => {
    try {
        const venues = await prismaClient_1.default.venue.findMany({
            where: {
                isActive: true
            },
            include: {
                courts: {
                    where: {
                        isActive: true
                    },
                    select: {
                        id: true,
                        name: true,
                        courtType: true,
                        surfaceType: true,
                        isIndoor: true,
                        pricePerHour: true
                    }
                },
                owner: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true
                    }
                }
            },
            orderBy: {
                rating: 'desc'
            }
        });
        return res.status(200).json({
            success: true,
            count: venues.length,
            data: venues
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch venues',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getAllVenues = getAllVenues;
/**
 * Get single futsal ground details
 * @route GET /:id
 */
const getVenueById = async (req, res) => {
    try {
        const { id } = req.params;
        const venue = await prismaClient_1.default.venue.findUnique({
            where: { id },
            include: {
                courts: {
                    where: {
                        isActive: true
                    },
                    include: {
                        timeSlots: {
                            orderBy: [
                                { dayOfWeek: 'asc' },
                                { startTime: 'asc' }
                            ]
                        }
                    }
                },
                owner: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true
                    }
                },
                reviews: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 2 // Get latest 10 reviews
                }
            }
        });
        if (!venue) {
            return res.status(404).json({
                success: false,
                message: 'Venue not found'
            });
        }
        if (!venue.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Venue is not active'
            });
        }
        return res.status(200).json({
            success: true,
            data: venue
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch venue details',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getVenueById = getVenueById;
/**
 * Search futsal grounds by filters
 * @route GET /search?location=&price=&city=&courtType=&minRating=
 */
const searchVenues = async (req, res) => {
    try {
        const { location, price, city, courtType, minRating } = req.query;
        // Build dynamic where clause
        const whereClause = {
            isActive: true
        };
        // Filter by location (search in address or city)
        if (location) {
            whereClause.OR = [
                { address: { contains: location, mode: 'insensitive' } },
                { city: { contains: location, mode: 'insensitive' } }
            ];
        }
        // Filter by city
        if (city) {
            whereClause.city = { contains: city, mode: 'insensitive' };
        }
        // Filter by minimum rating
        if (minRating) {
            const rating = parseFloat(minRating);
            if (!isNaN(rating)) {
                whereClause.rating = { gte: rating };
            }
        }
        // Build court filter for price and court type
        const courtWhere = {
            isActive: true
        };
        if (price) {
            const maxPrice = parseFloat(price);
            if (!isNaN(maxPrice)) {
                courtWhere.pricePerHour = { lte: maxPrice };
            }
        }
        if (courtType) {
            courtWhere.courtType = { contains: courtType, mode: 'insensitive' };
        }
        const venues = await prismaClient_1.default.venue.findMany({
            where: whereClause,
            include: {
                courts: {
                    where: courtWhere,
                    select: {
                        id: true,
                        name: true,
                        courtType: true,
                        surfaceType: true,
                        isIndoor: true,
                        pricePerHour: true
                    }
                },
                owner: {
                    select: {
                        id: true,
                        fullName: true,
                        phoneNumber: true
                    }
                }
            },
            orderBy: {
                rating: 'desc'
            }
        });
        // Filter out venues with no matching courts (if court filters were applied)
        const filteredVenues = (price || courtType)
            ? venues.filter(venue => venue.courts.length > 0)
            : venues;
        return res.status(200).json({
            success: true,
            count: filteredVenues.length,
            filters: {
                location,
                price,
                city,
                courtType,
                minRating
            },
            data: filteredVenues
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to search venues',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.searchVenues = searchVenues;
