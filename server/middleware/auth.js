import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { assert } from "../utils/errors.js";
export async function authenticate(req, res, next) {
  try {
    const token = req.cookies.cf_session;
    assert(token, "Please sign in", 401);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      assert(false, "Session expired. Please sign in again.", 401);
    }
    const user = await User.findById(payload.sub);
    assert(
      user?.active && user.tokenVersion === payload.version,
      "Session expired",
      401,
    );
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}
export const authorize =
  (...roles) =>
  (req, res, next) => {
    try {
      assert(
        roles.includes(req.user.role),
        "You do not have permission for this action",
        403,
      );
      next();
    } catch (e) {
      next(e);
    }
  };
export const operators = authorize("owner", "manager", "cashier");
export const managers = authorize("owner", "manager");
