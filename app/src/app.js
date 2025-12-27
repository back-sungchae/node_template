import express from "express";
import routes from "./routes/index.js";
import { request_logger } from "./middleware/request_logger.js";
import { error_handler } from "./middleware/error_handler.js";

const app = express();

app.use(express.json());
app.use(request_logger); // 요청 로그
app.use(routes); // 라우트
app.use(error_handler); // 에러 핸들러

export default app;
