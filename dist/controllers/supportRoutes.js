"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFAQs = exports.submitReport = void 0;
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
// Support ticket status enum
var TicketStatus;
(function (TicketStatus) {
    TicketStatus["OPEN"] = "OPEN";
    TicketStatus["IN_PROGRESS"] = "IN_PROGRESS";
    TicketStatus["RESOLVED"] = "RESOLVED";
    TicketStatus["CLOSED"] = "CLOSED";
})(TicketStatus || (TicketStatus = {}));
// Support ticket category enum
var TicketCategory;
(function (TicketCategory) {
    TicketCategory["BOOKING_ISSUE"] = "BOOKING_ISSUE";
    TicketCategory["PAYMENT_ISSUE"] = "PAYMENT_ISSUE";
    TicketCategory["VENUE_COMPLAINT"] = "VENUE_COMPLAINT";
    TicketCategory["TECHNICAL_ISSUE"] = "TECHNICAL_ISSUE";
    TicketCategory["ACCOUNT_ISSUE"] = "ACCOUNT_ISSUE";
    TicketCategory["GENERAL_INQUIRY"] = "GENERAL_INQUIRY";
    TicketCategory["OTHER"] = "OTHER";
})(TicketCategory || (TicketCategory = {}));
/**
 * Submit a complaint or issue
 * @route POST /report
 */
const submitReport = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const { subject, description, category, bookingId, venueId, priority = 'MEDIUM' } = req.body;
        // Validate required fields
        if (!subject || !description || !category) {
            return res.status(400).json({
                success: false,
                message: 'Subject, description, and category are required'
            });
        }
        // Validate category
        if (!Object.values(TicketCategory).includes(category)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category',
                validCategories: Object.values(TicketCategory)
            });
        }
        // Validate booking if provided
        if (bookingId) {
            const booking = await prismaClient_1.default.booking.findUnique({
                where: { id: bookingId }
            });
            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found'
                });
            }
            if (booking.userId !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only report issues for your own bookings'
                });
            }
        }
        // Validate venue if provided
        if (venueId) {
            const venue = await prismaClient_1.default.venue.findUnique({
                where: { id: venueId }
            });
            if (!venue) {
                return res.status(404).json({
                    success: false,
                    message: 'Venue not found'
                });
            }
        }
        // Generate ticket number
        const ticketNumber = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        // Create support ticket
        const ticket = await prismaClient_1.default.supportTicket.create({
            data: {
                userId: userId,
                ticketNumber: ticketNumber,
                subject: subject,
                description: description,
                category: category,
                bookingId: bookingId,
                venueId: venueId,
                priority: priority,
                status: TicketStatus.OPEN
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phoneNumber: true
                    }
                },
                booking: bookingId ? {
                    include: {
                        court: {
                            include: {
                                venue: true
                            }
                        }
                    }
                } : false,
                venue: venueId ? true : false
            }
        });
        // Create notification for user
        await prismaClient_1.default.notification.create({
            data: {
                userId: userId,
                title: 'Support Ticket Created',
                message: `Your support ticket ${ticketNumber} has been created. We'll get back to you soon.`,
                type: 'SUPPORT',
                isRead: false
            }
        });
        return res.status(201).json({
            success: true,
            message: 'Support ticket submitted successfully',
            data: ticket
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to submit report',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.submitReport = submitReport;
/**
 * Get list of FAQs or help topics
 * @route GET /faqs
 */
const getFAQs = async (req, res) => {
    try {
        const { category, search } = req.query;
        // Build where clause
        const whereClause = {
            isActive: true
        };
        if (category) {
            whereClause.category = category;
        }
        if (search) {
            whereClause.OR = [
                { question: { contains: search, mode: 'insensitive' } },
                { answer: { contains: search, mode: 'insensitive' } }
            ];
        }
        // Fetch FAQs from database
        const faqs = await prismaClient_1.default.fAQ.findMany({
            where: whereClause,
            orderBy: [
                { order: 'asc' },
                { createdAt: 'desc' }
            ],
            select: {
                id: true,
                question: true,
                answer: true,
                category: true,
                order: true,
                createdAt: true,
                updatedAt: true
            }
        });
        // If no FAQs in database, return static FAQs
        if (faqs.length === 0) {
            const staticFAQs = getStaticFAQs();
            // Filter static FAQs if category or search provided
            let filteredFAQs = staticFAQs;
            if (category) {
                filteredFAQs = filteredFAQs.filter(faq => faq.category === category);
            }
            if (search) {
                const searchLower = search.toLowerCase();
                filteredFAQs = filteredFAQs.filter(faq => faq.question.toLowerCase().includes(searchLower) ||
                    faq.answer.toLowerCase().includes(searchLower));
            }
            return res.status(200).json({
                success: true,
                count: filteredFAQs.length,
                categories: ['BOOKING', 'PAYMENT', 'ACCOUNT', 'VENUE', 'GENERAL'],
                data: filteredFAQs
            });
        }
        // Get unique categories
        const categories = [...new Set(faqs.map(faq => faq.category))];
        return res.status(200).json({
            success: true,
            count: faqs.length,
            categories: categories,
            data: faqs
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch FAQs',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getFAQs = getFAQs;
/**
 * Static FAQs for initial data
 */
function getStaticFAQs() {
    return [
        // Booking FAQs
        {
            id: '1',
            category: 'BOOKING',
            question: 'How do I book a futsal court?',
            answer: 'To book a futsal court, browse available venues, select your preferred court, choose date and time slot, then proceed with payment to confirm your booking.',
            order: 1
        },
        {
            id: '2',
            category: 'BOOKING',
            question: 'Can I cancel or reschedule my booking?',
            answer: 'Yes, you can cancel or reschedule your booking from the "My Bookings" section. Cancellation and rescheduling policies may vary by venue. Please check the specific venue\'s policy before booking.',
            order: 2
        },
        {
            id: '3',
            category: 'BOOKING',
            question: 'How far in advance can I book a court?',
            answer: 'You can book courts up to 30 days in advance. This allows you to plan your games well ahead of time.',
            order: 3
        },
        {
            id: '4',
            category: 'BOOKING',
            question: 'What happens if I arrive late for my booking?',
            answer: 'Your booking time is fixed. If you arrive late, your session will still end at the originally scheduled time. We recommend arriving 10-15 minutes early.',
            order: 4
        },
        // Payment FAQs
        {
            id: '5',
            category: 'PAYMENT',
            question: 'What payment methods are accepted?',
            answer: 'We accept payments through eSewa, Khalti, and Stripe. You can choose your preferred payment method during checkout.',
            order: 1
        },
        {
            id: '6',
            category: 'PAYMENT',
            question: 'Is my payment information secure?',
            answer: 'Yes, all payments are processed through secure, encrypted payment gateways. We do not store your payment card details on our servers.',
            order: 2
        },
        {
            id: '7',
            category: 'PAYMENT',
            question: 'Will I get a refund if I cancel my booking?',
            answer: 'Refund policies depend on the cancellation timing and venue policy. Generally, cancellations made 24 hours before the booking time are eligible for full refund.',
            order: 3
        },
        {
            id: '8',
            category: 'PAYMENT',
            question: 'Can I get a receipt for my payment?',
            answer: 'Yes, a digital receipt is sent to your registered email after successful payment. You can also view and download receipts from your payment history.',
            order: 4
        },
        // Account FAQs
        {
            id: '9',
            category: 'ACCOUNT',
            question: 'How do I create an account?',
            answer: 'Click on "Sign Up" button, enter your email, full name, phone number, and create a password. Verify your email to activate your account.',
            order: 1
        },
        {
            id: '10',
            category: 'ACCOUNT',
            question: 'I forgot my password. What should I do?',
            answer: 'Click on "Forgot Password" on the login page. Enter your registered email, and you\'ll receive a password reset link.',
            order: 2
        },
        {
            id: '11',
            category: 'ACCOUNT',
            question: 'How can I update my profile information?',
            answer: 'Go to your profile settings from the account menu. You can update your name, phone number, email, and other details there.',
            order: 3
        },
        {
            id: '12',
            category: 'ACCOUNT',
            question: 'Can I delete my account?',
            answer: 'Yes, you can delete your account from account settings. Please note that this action is permanent and will delete all your data including booking history.',
            order: 4
        },
        // Venue FAQs
        {
            id: '13',
            category: 'VENUE',
            question: 'How do I find venues near me?',
            answer: 'Use the search function and filter by location/city. You can also view all venues on the map to find ones closest to you.',
            order: 1
        },
        {
            id: '14',
            category: 'VENUE',
            question: 'Can I review a venue?',
            answer: 'Yes, you can leave a review and rating for any venue where you have completed a booking. Your honest feedback helps other users make informed decisions.',
            order: 2
        },
        {
            id: '15',
            category: 'VENUE',
            question: 'What amenities are available at venues?',
            answer: 'Amenities vary by venue and may include parking, changing rooms, showers, cafeteria, equipment rental, and more. Check the venue details page for specific amenities.',
            order: 3
        },
        // General FAQs
        {
            id: '16',
            category: 'GENERAL',
            question: 'What is the minimum and maximum booking duration?',
            answer: 'Minimum booking duration is typically 1 hour. Maximum duration varies by venue, but most allow bookings up to 3-4 hours per session.',
            order: 1
        },
        {
            id: '17',
            category: 'GENERAL',
            question: 'Do I need to bring my own equipment?',
            answer: 'Most venues provide the ball and basic equipment. However, we recommend bringing your own shoes and sportswear. Check with the specific venue for equipment availability.',
            order: 2
        },
        {
            id: '18',
            category: 'GENERAL',
            question: 'How do I contact customer support?',
            answer: 'You can contact us through the "Submit Report" option in the support section, or email us at support@futsalbooking.com. We typically respond within 24 hours.',
            order: 3
        },
        {
            id: '19',
            category: 'GENERAL',
            question: 'Are there any age restrictions?',
            answer: 'There are no specific age restrictions. However, minors under 16 should be accompanied by an adult. Some venues may have specific policies.',
            order: 4
        }
    ];
}
