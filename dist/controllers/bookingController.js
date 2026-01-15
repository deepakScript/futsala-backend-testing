"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescheduleBooking = exports.cancelBooking = exports.getBookingById = exports.getMyBookings = exports.createBooking = exports.checkAvailability = void 0;
const client_1 = require("@prisma/client");
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
/**
 * Check available time slots for a futsal
 * @route GET /availability/:futsalId?date=
 */
const checkAvailability = async (req, res) => {
    try {
        const futsalId = req.params.futsalId || req.query.futsalId;
        const { date } = req.query;
        if (!futsalId) {
            return res.status(400).json({
                success: false,
                message: 'Futsal ID is required (either as path parameter or query parameter)'
            });
        }
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }
        // Parse the date robustly
        // Use a simple split and Date.UTC to avoid timezone-related day shifts
        const [year, month, day] = date.split('-').map(Number);
        const bookingDate = new Date(Date.UTC(year, month - 1, day));
        if (isNaN(bookingDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }
        // Day of week from UTC to match our simple date string
        const dayOfWeek = bookingDate.getUTCDay(); // 0-6 (Sunday-Saturday)
        console.log(`[checkAvailability] Checking for date: ${date}, dayOfWeek: ${dayOfWeek}`);
        // Create start and end of day dates for the query
        const startOfDay = new Date(bookingDate);
        const endOfDay = new Date(bookingDate);
        endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
        // Get all courts for this venue
        const courts = await prismaClient_1.default.court.findMany({
            where: {
                venueId: futsalId,
                isActive: true
            },
            include: {
                timeSlots: {
                    where: {
                        dayOfWeek: dayOfWeek,
                        isAvailable: true
                    },
                    orderBy: {
                        startTime: 'asc'
                    }
                },
                bookings: {
                    where: {
                        bookingDate: {
                            gte: startOfDay,
                            lt: endOfDay
                        },
                        status: {
                            notIn: [client_1.BookingStatus.CANCELLED]
                        }
                    }
                }
            }
        });
        console.log(`[checkAvailability] Found ${courts.length} courts for venue ${futsalId}`);
        courts.forEach(c => {
            console.log(`  Court: ${c.name}, Slots: ${c.timeSlots.length}, Bookings: ${c.bookings.length}`);
        });
        // Process availability for each court into a flattened list of slots
        const flattenedAvailability = [];
        courts.forEach(court => {
            const bookedSlots = court.bookings.map(b => ({
                startTime: b.startTime,
                endTime: b.endTime
            }));
            court.timeSlots.forEach(slot => {
                // Check if slot overlaps with any booking
                const isBooked = bookedSlots.some(booked => {
                    return !(slot.endTime <= booked.startTime || slot.startTime >= booked.endTime);
                });
                flattenedAvailability.push({
                    courtId: court.id,
                    courtName: court.name,
                    courtType: court.courtType,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    price: court.pricePerHour, // Match frontend expected field 'price'
                    isAvailable: !isBooked
                });
            });
        });
        return res.status(200).json({
            success: true,
            date: date,
            dayOfWeek: dayOfWeek,
            data: flattenedAvailability
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to check availability',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.checkAvailability = checkAvailability;
/**
 * Create a new booking
 * @route POST /create
 */
const createBooking = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const { courtId, bookingDate, startTime, endTime, notes } = req.body;
        // Validate required fields
        if (!courtId || !bookingDate || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required: courtId, bookingDate, startTime, endTime'
            });
        }
        const bookingDateObj = new Date(bookingDate);
        if (isNaN(bookingDateObj.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }
        // Use a transaction to prevent race conditions
        const booking = await prismaClient_1.default.$transaction(async (tx) => {
            // Validate user exists
            const user = await tx.user.findUnique({
                where: { id: userId }
            });
            if (!user) {
                throw new Error('User not found. Please ensure you are using a valid user ID.');
            }
            // Get court details
            const court = await tx.court.findUnique({
                where: { id: courtId },
                include: { venue: true }
            });
            if (!court || !court.isActive) {
                throw new Error('Court not found or inactive');
            }
            // Calculate total hours and price
            const start = parseTime(startTime);
            const end = parseTime(endTime);
            const totalHours = (end - start) / 60; // Convert minutes to hours
            if (totalHours <= 0) {
                throw new Error('Invalid time range');
            }
            const totalPrice = totalHours * court.pricePerHour;
            // Check if slot is already booked (LOCKING/CHECKING within transaction)
            const existingBooking = await tx.booking.findFirst({
                where: {
                    courtId: courtId,
                    bookingDate: bookingDateObj,
                    status: {
                        notIn: [client_1.BookingStatus.CANCELLED]
                    },
                    OR: [
                        {
                            AND: [
                                { startTime: { lte: startTime } },
                                { endTime: { gt: startTime } }
                            ]
                        },
                        {
                            AND: [
                                { startTime: { lt: endTime } },
                                { endTime: { gte: endTime } }
                            ]
                        },
                        {
                            AND: [
                                { startTime: { gte: startTime } },
                                { endTime: { lte: endTime } }
                            ]
                        }
                    ]
                }
            });
            if (existingBooking) {
                throw new Error('Time slot is already booked');
            }
            // Create booking
            return await tx.booking.create({
                data: {
                    userId,
                    courtId,
                    bookingDate: bookingDateObj,
                    startTime,
                    endTime,
                    totalHours,
                    totalPrice,
                    notes,
                    status: client_1.BookingStatus.PENDING
                },
                include: {
                    court: {
                        include: {
                            venue: true
                        }
                    }
                }
            });
        });
        return res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking
        });
    }
    catch (error) {
        console.error('Create Booking Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Handle specific errors from the transaction
        if (errorMessage.includes('User not found')) {
            return res.status(404).json({
                success: false,
                message: 'User not found. Please ensure you are logged in with a valid account.'
            });
        }
        if (errorMessage === 'Court not found or inactive') {
            return res.status(404).json({ success: false, message: errorMessage });
        }
        if (errorMessage === 'Invalid time range') {
            return res.status(400).json({ success: false, message: errorMessage });
        }
        if (errorMessage === 'Time slot is already booked') {
            return res.status(409).json({ success: false, message: errorMessage });
        }
        // Handle Prisma foreign key constraint errors
        if (errorMessage.includes('Foreign key constraint')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reference: User or Court does not exist in the database.',
                error: errorMessage
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: errorMessage
        });
    }
};
exports.createBooking = createBooking;
/**
 * Get all bookings of logged-in user
 * @route GET /my
 */
const getMyBookings = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const bookings = await prismaClient_1.default.booking.findMany({
            where: { userId },
            include: {
                court: {
                    include: {
                        venue: {
                            select: {
                                id: true,
                                name: true,
                                address: true,
                                city: true,
                                phoneNumber: true,
                                images: true
                            }
                        }
                    }
                },
                payment: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch bookings',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getMyBookings = getMyBookings;
/**
 * Get booking details
 * @route GET /:id
 */
const getBookingById = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const booking = await prismaClient_1.default.booking.findUnique({
            where: { id },
            include: {
                court: {
                    include: {
                        venue: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true
                    }
                },
                payment: true
            }
        });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        // Check if user owns this booking or is the venue owner
        if (booking.userId !== userId && booking.court.venue.ownerId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        return res.status(200).json({
            success: true,
            data: booking
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch booking details',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getBookingById = getBookingById;
/**
 * Cancel a booking
 * @route PUT /cancel/:id
 */
const cancelBooking = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const booking = await prismaClient_1.default.booking.findUnique({
            where: { id }
        });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        // Check if user owns this booking
        if (booking.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only cancel your own bookings'
            });
        }
        // Check if booking can be cancelled
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            return res.status(400).json({
                success: false,
                message: 'Booking is already cancelled'
            });
        }
        if (booking.status === client_1.BookingStatus.COMPLETED) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel completed booking'
            });
        }
        // Update booking status
        const updatedBooking = await prismaClient_1.default.booking.update({
            where: { id },
            data: {
                status: client_1.BookingStatus.CANCELLED
            },
            include: {
                court: {
                    include: {
                        venue: true
                    }
                }
            }
        });
        return res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: updatedBooking
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel booking',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.cancelBooking = cancelBooking;
/**
 * Reschedule a booking
 * @route PUT /reschedule/:id
 */
const rescheduleBooking = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { bookingDate, startTime, endTime } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const booking = await prismaClient_1.default.booking.findUnique({
            where: { id },
            include: {
                court: true
            }
        });
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }
        // Check if user owns this booking
        if (booking.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only reschedule your own bookings'
            });
        }
        // Check if booking can be rescheduled
        if (booking.status === client_1.BookingStatus.CANCELLED || booking.status === client_1.BookingStatus.COMPLETED) {
            return res.status(400).json({
                success: false,
                message: 'Cannot reschedule cancelled or completed booking'
            });
        }
        // Prepare update data
        const updateData = {};
        let recalculatePrice = false;
        if (bookingDate) {
            updateData.bookingDate = new Date(bookingDate);
        }
        if (startTime) {
            updateData.startTime = startTime;
            recalculatePrice = true;
        }
        if (endTime) {
            updateData.endTime = endTime;
            recalculatePrice = true;
        }
        // Recalculate total hours and price if time changed
        if (recalculatePrice) {
            const newStartTime = startTime || booking.startTime;
            const newEndTime = endTime || booking.endTime;
            const start = parseTime(newStartTime);
            const end = parseTime(newEndTime);
            const totalHours = (end - start) / 60;
            if (totalHours <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid time range'
                });
            }
            updateData.totalHours = totalHours;
            updateData.totalPrice = totalHours * booking.court.pricePerHour;
        }
        // Check for conflicts with new time slot
        const newBookingDate = bookingDate ? new Date(bookingDate) : booking.bookingDate;
        const newStartTime = startTime || booking.startTime;
        const newEndTime = endTime || booking.endTime;
        const conflictingBooking = await prismaClient_1.default.booking.findFirst({
            where: {
                id: { not: id }, // Exclude current booking
                courtId: booking.courtId,
                bookingDate: newBookingDate,
                status: {
                    notIn: [client_1.BookingStatus.CANCELLED]
                },
                OR: [
                    {
                        AND: [
                            { startTime: { lte: newStartTime } },
                            { endTime: { gt: newStartTime } }
                        ]
                    },
                    {
                        AND: [
                            { startTime: { lt: newEndTime } },
                            { endTime: { gte: newEndTime } }
                        ]
                    },
                    {
                        AND: [
                            { startTime: { gte: newStartTime } },
                            { endTime: { lte: newEndTime } }
                        ]
                    }
                ]
            }
        });
        if (conflictingBooking) {
            return res.status(409).json({
                success: false,
                message: 'New time slot is already booked'
            });
        }
        // Update booking
        const updatedBooking = await prismaClient_1.default.booking.update({
            where: { id },
            data: updateData,
            include: {
                court: {
                    include: {
                        venue: true
                    }
                }
            }
        });
        return res.status(200).json({
            success: true,
            message: 'Booking rescheduled successfully',
            data: updatedBooking
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to reschedule booking',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.rescheduleBooking = rescheduleBooking;
// Helper function to parse time string to minutes
function parseTime(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
