import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./company/profile";
import bookingsRouter from "./company/bookings";
import catalogsRouter from "./company/catalogs";
import earningsRouter from "./company/earnings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(bookingsRouter);
router.use(catalogsRouter);
router.use(earningsRouter);

export default router;
