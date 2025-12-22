import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_REFRESH_SECRET as string;


// Define the type of decoded token payload
interface DecodedUser extends JwtPayload {
  userId: string;
  email?: string; // optional fields if you store them in token
}

// Extend Express Request type to include `user`
declare module "express-serve-static-core" {
  interface Request {
    user?: DecodedUser;
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization; // lowercase 'authorization'
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedUser;
    req.user = decoded; // attach user info to req
    next();
  } catch (error) {
    console.error("Error verifying token:", (error as Error).message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
