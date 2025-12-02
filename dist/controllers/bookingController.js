"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescheduleBooking = exports.cancelBooking = exports.getBookingById = exports.getMyBookings = exports.createBooking = exports.checkAvailability = void 0;
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
// BookingStatus enum (should match your Prisma schema)
var BookingStatus;
(function (BookingStatus) {
    BookingStatus["PENDING"] = "PENDING";
    BookingStatus["CONFIRMED"] = "CONFIRMED";
    BookingStatus["COMPLETED"] = "COMPLETED";
    BookingStatus["CANCELLED"] = "CANCELLED";
    BookingStatus["REJECTED"] = "REJECTED";
})(BookingStatus || (BookingStatus = {}));
/**
 * Check available time slots for a futsal
 * @route GET /availability/:futsalId?date=
 */
const checkAvailability = async (req, res) => {
    try {
        const { futsalId } = req.params;
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }
        // Parse the date and get day of week
        const bookingDate = new Date(date);
        const dayOfWeek = bookingDate.getDay(); // 0-6 (Sunday-Saturday)
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
                            gte: new Date(date),
                            lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
                        },
                        status: {
                            notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED]
                        }
                    }
                }
            }
        });
        // Process availability for each court
        const availability = courts.map(court => {
            const bookedSlots = court.bookings.map(b => ({
                startTime: b.startTime,
                endTime: b.endTime
            }));
            const availableSlots = court.timeSlots.filter(slot => {
                // Check if slot overlaps with any booking
                const isBooked = bookedSlots.some(booked => {
                    return !(slot.endTime <= booked.startTime || slot.startTime >= booked.endTime);
                });
                return !isBooked;
            });
            return {
                courtId: court.id,
                courtName: court.name,
                courtType: court.courtType,
                pricePerHour: court.pricePerHour,
                availableSlots: availableSlots.map(slot => ({
                    startTime: slot.startTime,
                    endTime: slot.endTime
                }))
            };
        });
        return res.status(200).json({
            success: true,
            date: date,
            dayOfWeek: dayOfWeek,
            data: availability
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
        const userId = req.user?.id;
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
        // Get court details
        const court = await prismaClient_1.default.court.findUnique({
            where: { id: courtId },
            include: { venue: true }
        });
        if (!court || !court.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Court not found or inactive'
            });
        }
        // Calculate total hours and price
        const start = parseTime(startTime);
        const end = parseTime(endTime);
        const totalHours = (end - start) / 60; // Convert minutes to hours
        if (totalHours <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid time range'
            });
        }
        const totalPrice = totalHours * court.pricePerHour;
        // Check if slot is already booked
        const existingBooking = await prismaClient_1.default.booking.findFirst({
            where: {
                courtId: courtId,
                bookingDate: new Date(bookingDate),
                status: {
                    notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED]
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
            return res.status(409).json({
                success: false,
                message: 'Time slot is already booked'
            });
        }
        // Create booking
        const booking = await prismaClient_1.default.booking.create({
            data: {
                userId,
                courtId,
                bookingDate: new Date(bookingDate),
                startTime,
                endTime,
                totalHours,
                totalPrice,
                notes,
                status: BookingStatus.PENDING
            },
            include: {
                court: {
                    include: {
                        venue: true
                    }
                }
            }
        });
        return res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: error instanceof Error ? error.message : 'Unknown error'
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
        const userId = req.user?.id;
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
        const userId = req.user?.id;
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
        const userId = req.user?.id;
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
        if (booking.status === BookingStatus.CANCELLED) {
            return res.status(400).json({
                success: false,
                message: 'Booking is already cancelled'
            });
        }
        if (booking.status === BookingStatus.COMPLETED) {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel completed booking'
            });
        }
        // Update booking status
        const updatedBooking = await prismaClient_1.default.booking.update({
            where: { id },
            data: {
                status: BookingStatus.CANCELLED
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
        const userId = req.user?.id;
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
        if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
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
                    notIn: [BookingStatus.CANCELLED, BookingStatus.REJECTED]
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
