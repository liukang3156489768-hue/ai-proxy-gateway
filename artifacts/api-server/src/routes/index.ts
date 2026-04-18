import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import statsRouter from "./stats";
import keysRouter from "./keys";
import versionRouter from "./version";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proxyRouter);
router.use(statsRouter);
router.use(keysRouter);
router.use(versionRouter);

export default router;
