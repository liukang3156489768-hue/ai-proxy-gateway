import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import statsRouter from "./stats";
import keysRouter from "./keys";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proxyRouter);
router.use(statsRouter);
router.use(keysRouter);

export default router;
