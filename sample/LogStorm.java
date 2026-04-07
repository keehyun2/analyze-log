import java.util.Random;
import java.util.concurrent.*;
import java.util.logging.*;

/**
 * LogStorm - 로그 추적 테스트용 샘플 프로그램
 * 실행: javac LogStorm.java && java LogStorm
 */
public class LogStorm {

    static final Logger logger = Logger.getLogger("LogStorm");
    static final Random rand = new Random();

    // --- 시뮬레이션 대상: 주문 처리 시스템 ---

    static final String[] USERS    = {"alice", "bob", "charlie", "diana", "eve"};
    static final String[] PRODUCTS = {"ITEM-001", "ITEM-042", "ITEM-099", "ITEM-777"};
    static final String[] SERVICES = {"OrderService", "PaymentService", "InventoryService", "NotificationService"};

    public static void main(String[] args) throws InterruptedException {
        setupLogger();

        int threads   = 4;   // 동시 작업 스레드 수
        int logPerSec = 3;  // 초당 로그 수 (조절 가능)

        logger.info("=== LogStorm 시작 (threads=" + threads + ", logPerSec=" + logPerSec + ") ===");

        ExecutorService pool = Executors.newFixedThreadPool(threads);

        // 백그라운드 에러 발생기
        pool.submit(() -> errorBomb());

        // 주문 처리 시뮬레이터 (다중 스레드)
        for (int i = 0; i < threads - 1; i++) {
            final int id = i;
            pool.submit(() -> orderLoop(id, logPerSec));
        }

        // 메인: 시스템 상태 주기적 출력
        while (!Thread.currentThread().isInterrupted()) {
            Thread.sleep(5000);
            logger.info("[HEARTBEAT] active-threads=" + threads + " memory=" + usedMemoryMB() + "MB");
        }
    }

    /** 주문 처리 흐름 시뮬레이션 */
    static void orderLoop(int workerId, int logPerSec) {
        long intervalMs = 1000L / logPerSec;
        int orderId = workerId * 10000;

        while (true) {
            try {
                String user    = USERS[rand.nextInt(USERS.length)];
                String product = PRODUCTS[rand.nextInt(PRODUCTS.length)];
                int qty        = rand.nextInt(9) + 1;
                orderId++;

                // 주문 접수
                logger.info(String.format("[worker-%d] ORDER RECEIVED  orderId=%d user=%s product=%s qty=%d",
                        workerId, orderId, user, product, qty));

                sleep(intervalMs);

                // 재고 확인
                if (rand.nextInt(10) < 2) {
                    logger.warning(String.format("[worker-%d] STOCK LOW       orderId=%d product=%s remaining=%d",
                            workerId, orderId, product, rand.nextInt(5)));
                } else {
                    logger.fine(String.format("[worker-%d] STOCK OK        orderId=%d product=%s",
                            workerId, orderId, product));
                }

                sleep(intervalMs);

                // 결제 처리
                if (rand.nextInt(10) < 1) {
                    logger.severe(String.format("[worker-%d] PAYMENT FAILED  orderId=%d user=%s reason=CARD_DECLINED",
                            workerId, orderId, user));
                    continue;
                }
                logger.info(String.format("[worker-%d] PAYMENT OK     orderId=%d amount=%d",
                        workerId, orderId, qty * (rand.nextInt(50000) + 5000)));

                sleep(intervalMs);

                // 배송 등록
                String trackingNo = "TRK-" + (100000 + rand.nextInt(900000));
                logger.info(String.format("[worker-%d] SHIPPED        orderId=%d tracking=%s",
                        workerId, orderId, trackingNo));

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                logger.log(Level.SEVERE, "[worker-" + workerId + "] Unexpected error", e);
            }
        }
    }

    /** 주기적으로 예외 스택트레이스 발생 (추적 도구 테스트용) */
    static void errorBomb() {
        while (true) {
            try {
                Thread.sleep(3000 + rand.nextInt(4000));
                String svc = SERVICES[rand.nextInt(SERVICES.length)];

                try {
                    simulateCrash(svc);
                } catch (Exception e) {
                    logger.log(Level.SEVERE, "[ErrorBomb] Exception in " + svc, e);
                }

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    static void simulateCrash(String svc) {
        if (svc.equals("PaymentService")) {
            throw new RuntimeException("Connection timeout to payment gateway");
        } else if (svc.equals("InventoryService")) {
            throw new IllegalStateException("Inventory sync failed: DB locked");
        } else {
            throw new RuntimeException("Unexpected error in " + svc);
        }
    }

    static long usedMemoryMB() {
        Runtime rt = Runtime.getRuntime();
        return (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
    }

    static void sleep(long ms) throws InterruptedException {
        if (ms > 0) Thread.sleep(ms);
    }

    static void setupLogger() {
        // 콘솔 출력 포맷 설정
        ConsoleHandler handler = new ConsoleHandler();
        handler.setLevel(Level.ALL);
        handler.setFormatter(new SimpleFormatter() {
            private static final String FMT = "%1$tF %1$tT.%1$tL [%4$-7s] %5$s%6$s%n";
            @Override
            public String format(LogRecord r) {
                return String.format(FMT,
                        r.getMillis(), null, r.getLoggerName(),
                        r.getLevel().getLocalizedName(),
                        formatMessage(r),
                        r.getThrown() == null ? "" : "\n" + throwableToString(r.getThrown()));
            }
            private String throwableToString(Throwable t) {
                StringBuilder sb = new StringBuilder(t.toString());
                for (StackTraceElement e : t.getStackTrace()) sb.append("\n\tat ").append(e);
                return sb.toString();
            }
        });

        Logger root = Logger.getLogger("");
        root.setLevel(Level.ALL);
        for (Handler h : root.getHandlers()) root.removeHandler(h);
        root.addHandler(handler);
    }
}
