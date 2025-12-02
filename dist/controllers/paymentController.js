"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentHistory = exports.verifyPayment = exports.initiatePayment = void 0;
const prismaClient_1 = __importDefault(require("../config/prismaClient"));
const crypto_1 = __importDefault(require("crypto"));
// Payment status enum (should match your Prisma schema)
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["COMPLETED"] = "COMPLETED";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus || (PaymentStatus = {}));
// Payment method enum
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["ESEWA"] = "ESEWA";
    PaymentMethod["KHALTI"] = "KHALTI";
    PaymentMethod["STRIPE"] = "STRIPE";
    PaymentMethod["CASH"] = "CASH";
})(PaymentMethod || (PaymentMethod = {}));
/**
 * Initiate a payment
 * @route POST /initiate
 */
const initiatePayment = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const { bookingId, paymentMethod } = req.body;
        // Validate required fields
        if (!bookingId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID and payment method are required'
            });
        }
        // Get booking details
        const booking = await prismaClient_1.default.booking.findUnique({
            where: { id: bookingId },
            include: {
                court: {
                    include: {
                        venue: true
                    }
                },
                user: true
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
                message: 'You can only pay for your own bookings'
            });
        }
        // Check if booking already has a completed payment
        const existingPayment = await prismaClient_1.default.payment.findFirst({
            where: {
                bookingId: bookingId,
                status: PaymentStatus.COMPLETED
            }
        });
        if (existingPayment) {
            return res.status(400).json({
                success: false,
                message: 'Booking is already paid'
            });
        }
        // Generate unique transaction reference
        const transactionId = `TXN-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
        // Create payment record
        const payment = await prismaClient_1.default.payment.create({
            data: {
                bookingId: bookingId,
                amount: booking.totalPrice,
                paymentMethod: paymentMethod,
                transactionId: transactionId,
                status: PaymentStatus.PENDING
            }
        });
        // Prepare payment gateway specific data
        let paymentGatewayData = {};
        switch (paymentMethod.toUpperCase()) {
            case PaymentMethod.ESEWA:
                paymentGatewayData = {
                    amount: booking.totalPrice,
                    tax_amount: 0,
                    total_amount: booking.totalPrice,
                    transaction_uuid: transactionId,
                    product_code: process.env.ESEWA_PRODUCT_CODE || 'EPAYTEST',
                    product_service_charge: 0,
                    product_delivery_charge: 0,
                    success_url: `${process.env.FRONTEND_URL}/payment/success`,
                    failure_url: `${process.env.FRONTEND_URL}/payment/failure`,
                    signed_field_names: 'total_amount,transaction_uuid,product_code',
                    // signature: generateEsewaSignature(...)
                };
                break;
            case PaymentMethod.KHALTI:
                paymentGatewayData = {
                    return_url: `${process.env.FRONTEND_URL}/payment/verify`,
                    website_url: process.env.FRONTEND_URL,
                    amount: booking.totalPrice * 100, // Khalti expects amount in paisa
                    purchase_order_id: transactionId,
                    purchase_order_name: `Booking for ${booking.court.venue.name}`,
                    customer_info: {
                        name: booking.user.fullName,
                        email: booking.user.email,
                        phone: booking.user.phoneNumber
                    }
                };
                break;
            case PaymentMethod.STRIPE:
                paymentGatewayData = {
                    amount: Math.round(booking.totalPrice * 100), // Stripe expects amount in cents
                    currency: 'npr',
                    description: `Booking for ${booking.court.venue.name} - ${booking.court.name}`,
                    metadata: {
                        bookingId: bookingId,
                        transactionId: transactionId
                    }
                };
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment method'
                });
        }
        return res.status(200).json({
            success: true,
            message: 'Payment initiated successfully',
            data: {
                paymentId: payment.id,
                transactionId: transactionId,
                amount: booking.totalPrice,
                paymentMethod: paymentMethod,
                booking: {
                    id: booking.id,
                    venueName: booking.court.venue.name,
                    courtName: booking.court.name,
                    date: booking.bookingDate,
                    startTime: booking.startTime,
                    endTime: booking.endTime
                },
                paymentGatewayData: paymentGatewayData
            }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to initiate payment',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.initiatePayment = initiatePayment;
/**
 * Verify payment after completion
 * @route POST /verify
 */
const verifyPayment = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const { paymentId, transactionId, paymentMethod, 
        // eSewa params
        oid, amt, refId, 
        // Khalti params
        token, amount, 
        // Stripe params
        paymentIntentId } = req.body;
        // Validate required fields
        if (!paymentId || !transactionId || !paymentMethod) {
            return res.status(400).json({
                success: false,
                message: 'Payment ID, transaction ID, and payment method are required'
            });
        }
        // Get payment record
        const payment = await prismaClient_1.default.payment.findUnique({
            where: { id: paymentId },
            include: {
                booking: {
                    include: {
                        court: {
                            include: {
                                venue: true
                            }
                        }
                    }
                }
            }
        });
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }
        // Check if user owns this payment's booking
        if (payment.booking.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        // Check if payment is already verified
        if (payment.status === PaymentStatus.COMPLETED) {
            return res.status(400).json({
                success: false,
                message: 'Payment already verified'
            });
        }
        let verificationSuccess = false;
        let verificationMessage = '';
        // Verify payment based on payment method
        switch (paymentMethod.toUpperCase()) {
            case PaymentMethod.ESEWA:
                // Verify eSewa payment
                // In production, make API call to eSewa verification endpoint
                if (oid && amt && refId) {
                    // verificationSuccess = await verifyEsewaPayment(oid, amt, refId);
                    verificationSuccess = true; // Mock verification
                    verificationMessage = 'eSewa payment verified';
                }
                break;
            case PaymentMethod.KHALTI:
                // Verify Khalti payment
                // In production, make API call to Khalti verification endpoint
                if (token && amount) {
                    // verificationSuccess = await verifyKhaltiPayment(token, amount);
                    verificationSuccess = true; // Mock verification
                    verificationMessage = 'Khalti payment verified';
                }
                break;
            case PaymentMethod.STRIPE:
                // Verify Stripe payment
                // In production, use Stripe SDK to verify payment intent
                if (paymentIntentId) {
                    // verificationSuccess = await verifyStripePayment(paymentIntentId);
                    verificationSuccess = true; // Mock verification
                    verificationMessage = 'Stripe payment verified';
                }
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment method'
                });
        }
        if (!verificationSuccess) {
            // Update payment status to failed
            await prismaClient_1.default.payment.update({
                where: { id: paymentId },
                data: {
                    status: PaymentStatus.FAILED
                }
            });
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }
        // Update payment status to completed
        const updatedPayment = await prismaClient_1.default.$transaction(async (tx) => {
            // Update payment
            const payment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: PaymentStatus.COMPLETED,
                    paidAt: new Date()
                }
            });
            // Update booking payment status
            await tx.booking.update({
                where: { id: payment.bookingId },
                data: {
                    paymentStatus: PaymentStatus.COMPLETED,
                    status: 'CONFIRMED'
                }
            });
            // Create notification for user
            await tx.notification.create({
                data: {
                    userId: userId,
                    title: 'Payment Successful',
                    message: `Your payment of NPR ${payment.amount} has been confirmed. Booking is now confirmed.`,
                    type: 'PAYMENT',
                    isRead: false
                }
            });
            return payment;
        });
        return res.status(200).json({
            success: true,
            message: verificationMessage,
            data: updatedPayment
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to verify payment',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.verifyPayment = verifyPayment;
/**
 * View user payment history
 * @route GET /history
 */
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }
        const payments = await prismaClient_1.default.payment.findMany({
            where: {
                booking: {
                    userId: userId
                }
            },
            include: {
                booking: {
                    include: {
                        court: {
                            include: {
                                venue: {
                                    select: {
                                        id: true,
                                        name: true,
                                        address: true,
                                        city: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        // Calculate statistics
        const totalAmount = payments
            .filter(p => p.status === PaymentStatus.COMPLETED)
            .reduce((sum, p) => sum + p.amount, 0);
        const completedCount = payments.filter(p => p.status === PaymentStatus.COMPLETED).length;
        const pendingCount = payments.filter(p => p.status === PaymentStatus.PENDING).length;
        const failedCount = payments.filter(p => p.status === PaymentStatus.FAILED).length;
        return res.status(200).json({
            success: true,
            count: payments.length,
            statistics: {
                totalAmount: totalAmount,
                completed: completedCount,
                pending: pendingCount,
                failed: failedCount
            },
            data: payments
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch payment history',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getPaymentHistory = getPaymentHistory;
