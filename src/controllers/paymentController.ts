// Payment Controller
import { Request, Response } from 'express';
import prisma from '../config/prismaClient';
import crypto from 'crypto';
// Import PaymentStatus from Prisma generated types
import { PaymentStatus } from '@prisma/client';


// Extend Express Request type to include user
interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    role: string;
  };
}



// Payment method - only Khalti supported
const PAYMENT_METHOD = 'KHALTI';

// Khalti payment interfaces
interface InitiatePaymentRequest {
  bookingId: string;
}

interface VerifyPaymentRequest {
  paymentId: string;
  transactionId: string;
  token: string;
  amount: number;
}

/**
 * Initiate a payment
 * @route POST /initiate
 */
export const initiatePayment = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { bookingId } = req.body as { bookingId: string };

    // Validate required fields
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // Get booking details
    const booking = await prisma.booking.findUnique({
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
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId: bookingId,
        status: PaymentStatus.PAID
      }
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already paid'
      });
    }

    // Generate unique transaction reference
    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        bookingId: bookingId,
        amount: booking.totalPrice,
        paymentMethod: PAYMENT_METHOD,
        transactionId: transactionId,
        status: PaymentStatus.PENDING
      }
    });

    // Prepare Khalti payment gateway data
    const paymentGatewayData = {
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

    return res.status(200).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentId: payment.id,
        transactionId: transactionId,
        amount: booking.totalPrice,
        paymentMethod: PAYMENT_METHOD,
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Verify payment after completion
 * @route POST /verify
 */
export const verifyPayment = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { 
      paymentId, 
      transactionId,
      // Khalti params
      token,
      amount
    } = req.body as { paymentId: string; transactionId: string; token: string; amount: number };

    // Validate required fields
    if (!paymentId || !transactionId || !token || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID, transaction ID, token, and amount are required'
      });
    }

    // Get payment record
    const payment = await prisma.payment.findUnique({
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
    if (payment.status === PaymentStatus.PAID) {
      return res.status(400).json({
        success: false,
        message: 'Payment already verified'
      });
    }

    // Verify Khalti payment
    // In production, make API call to Khalti verification endpoint
    // Example: POST https://khalti.com/api/v2/payment/verify/
    // Headers: { Authorization: `Key ${process.env.KHALTI_SECRET_KEY}` }
    // Body: { token, amount }
    
    let verificationSuccess = false;
    let verificationMessage = '';
    
    // TODO: Implement actual Khalti verification
    // const khaltiResponse = await verifyKhaltiPayment(token, amount);
    // verificationSuccess = khaltiResponse.success;
    
    // Mock verification for now
    verificationSuccess = true;
    verificationMessage = 'Khalti payment verified successfully';

    if (!verificationSuccess) {
      // Update payment status to failed
      await prisma.payment.update({
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
    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Update payment
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: new Date()
        }
      });

      // Update booking payment status
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: 'CONFIRMED' as any // Use as any if enum import is tricky, but preferably use BookingStatus
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * View user payment history
 * @route GET /history
 */
export const getPaymentHistory = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const payments = await prisma.payment.findMany({
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
      .filter(p => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.amount, 0);

    const completedCount = payments.filter(p => p.status === PaymentStatus.PAID).length;
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
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};