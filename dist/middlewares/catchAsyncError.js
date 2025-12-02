"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catchAsyncError = void 0;
const catchAsyncError = (theFunction) => {
    return (req, res, next) => {
        Promise.resolve(theFunction(req, res, next)).catch(next);
    };
};
exports.catchAsyncError = catchAsyncError;
