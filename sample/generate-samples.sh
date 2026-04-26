#!/bin/bash

cd /home/keehyun/dev/analyze-log/sample

# 1. dd.log format: timestamp [LEVEL] [thread] message
cat > sample-log-01-dd.log << 'LOG'
2026-04-26 10:15:23.456 [INFO   ] [worker-0] ORDER RECEIVED  orderId=10001 user=alice product=ITEM-001 qty=3
2026-04-26 10:15:23.567 [INFO   ] [worker-1] ORDER RECEIVED  orderId=10002 user=bob product=ITEM-042 qty=1
2026-04-26 10:15:23.678 [FINE   ] [worker-0] STOCK OK        orderId=10001 product=ITEM-001
2026-04-26 10:15:23.789 [WARNING] [worker-0] STOCK LOW       orderId=10001 product=ITEM-001 remaining=2
2026-04-26 10:15:23.890 [INFO   ] [worker-0] PAYMENT OK     orderId=10001 amount=15000
2026-04-26 10:15:24.001 [SEVERE ] [worker-1] PAYMENT FAILED  orderId=10002 user=bob reason=CARD_DECLINED
2026-04-26 10:15:24.112 [INFO   ] [worker-0] SHIPPED        orderId=10001 tracking=TRK-123456
2026-04-26 10:15:24.223 [INFO   ] [main] [HEARTBEAT] active-threads=4 memory=245MB
2026-04-26 10:15:25.334 [SEVERE ] [ErrorBomb] Exception in PaymentService
java.lang.RuntimeException: Connection timeout to payment gateway
	at PaymentService.process(PaymentService.java:45)
	at OrderLoop.processPayment(OrderLoop.java:78)
	at OrderLoop.run(OrderLoop.java:35)
LOG

# 2. rtls format: timestamp LEVEL [Source:line] - message
cat > sample-log-02-rtls.log << 'LOG'
2026-04-26 10:20:15.123 INFO  [OrderService.createOrder:42] - Order created: orderId=20001, user=charlie
2026-04-26 10:20:15.234 DEBUG [InventoryService.checkStock:67] - Checking stock for ITEM-099: available=15
2026-04-26 10:20:15.345 INFO  [InventoryService.checkStock:68] - Stock confirmed for ITEM-099
2026-04-26 10:20:15.456 WARN  [InventoryService.checkStock:72] - Low stock threshold reached: ITEM-099, remaining=3
2026-04-26 10:20:15.567 INFO  [PaymentService.charge:89] - Payment processed: orderId=20001, amount=45000
2026-04-26 10:20:15.678 ERROR [PaymentService.charge:95] - Payment declined: orderId=20002, card=****1234
2026-04-26 10:20:15.789 INFO  [ShippingService.createShipment:23] - Shipment created: tracking=TRK-789012
2026-04-26 10:20:15.890 ERROR [OrderService.createOrder:55] - Failed to create order
	com.example.OrderException: Invalid product code: INVALID-999
	at OrderService.validateProduct(OrderService.java:120)
	at OrderService.createOrder(OrderService.java:48)
	at OrderController.submit(OrderController.java:33)
LOG

# 3. Thread-first format: timestamp [thread] LEVEL class.method - message
cat > sample-log-03-application.log << 'LOG'
2026-04-26 10:25:10.001 [main] INFO  com.example.Application.startup - Application starting...
2026-04-26 10:25:10.002 [main] INFO  com.example.Database.connect - Connecting to database: jdbc:mysql://localhost:3306/mydb
2026-04-26 10:25:10.123 [main] INFO  com.example.Database.connect - Database connection established
2026-04-26 10:25:10.234 [main] DEBUG com.example.Cache.init - Initializing cache with maxsize=1000
2026-04-26 10:25:10.345 [pool-1-thread-1] INFO  com.example.scheduler.JobExecutor.execute - Scheduled job started: DailyReportJob
2026-04-26 10:25:10.456 [pool-1-thread-1] INFO  com.example.scheduler.JobExecutor.execute - Scheduled job completed: DailyReportJob, duration=112ms
2026-04-26 10:25:11.567 [http-nio-8080-exec-1] INFO  com.example.web.UserController.login - User login attempt: userId=diana
2026-04-26 10:25:11.678 [http-nio-8080-exec-1] INFO  com.example.web.UserController.login - User logged in successfully: userId=diana, sessionId=abc123def
2026-04-26 10:25:12.789 [http-nio-8080-exec-2] WARN  com.example.web.ProductController.getProduct - Product not found: productId=ITEM-999
2026-04-26 10:25:13.890 [http-nio-8080-exec-3] ERROR com.example.web.OrderController.submitOrder - Order submission failed
	java.lang.NullPointerException: Cannot invoke "String.length()" because "customerEmail" is null
		at com.example.web.OrderController.validateEmail(OrderController.java:78)
		at com.example.web.OrderController.submitOrder(OrderController.java:45)
		at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
LOG

# 4. Database log format (thread-first variant)
cat > sample-log-04-database.log << 'LOG'
2026-04-26 10:30:05.111 [connection-pool-1] DEBUG  com.example.db.ConnectionPool.getConnection - Getting connection from pool
2026-04-26 10:30:05.222 [connection-pool-1] DEBUG  com.example.db.ConnectionPool.getConnection - Connection acquired: active=3, idle=7
2026-04-26 10:30:05.333 [connection-pool-1] INFO   com.example.db.QueryExecutor.execute - Executing query: SELECT * FROM users WHERE id=?
2026-04-26 10:30:05.444 [connection-pool-1] DEBUG  com.example.db.QueryExecutor.execute - Query executed in 111ms, rows=1
2026-04-26 10:30:05.555 [connection-pool-2] INFO   com.example.db.QueryExecutor.execute - Executing query: INSERT INTO orders (user_id, product_id) VALUES (?, ?)
2026-04-26 10:30:05.666 [connection-pool-2] DEBUG  com.example.db.QueryExecutor.execute - Insert successful: generatedId=30001
2026-04-26 10:30:05.777 [connection-pool-1] ERROR  com.example.db.TransactionManager.rollback - Transaction rollback due to error
	java.sql.SQLException: Foreign key constraint violation: user_id not found
		at com.example.db.TransactionManager.commit(TransactionManager.java:56)
		at com.example.service.OrderService.createOrder(OrderService.java:89)
2026-04-26 10:30:05.888 [connection-pool-2] WARN   com.example.db.SlowQueryDetector.detectQuery - Slow query detected: duration=2345ms, query=SELECT * FROM audit_logs WHERE created_at > ?
2026-04-26 10:30:06.999 [connection-cleaner] INFO  com.example.db.ConnectionCleaner.cleanup - Cleaning up idle connections: removed=2
LOG

# 5. Security log format: timestamp LEVEL [CONTEXT] EVENT key=value pairs
cat > sample-log-05-security.log << 'LOG'
2026-04-26 10:35:07.111 INFO  [SECURITY] AUTHENTICATION success userId=eve method=PASSWORD ip=192.168.1.100
2026-04-26 10:35:07.222 INFO  [SECURITY] AUTHENTICATION failure userId=unknown method=PASSWORD ip=192.168.1.101 reason=Invalid credentials
2026-04-26 10:35:07.333 WARN  [SECURITY] BRUTE_FORCE_DETECTED userId=alice attempts=5 duration=60s
2026-04-26 10:35:07.444 INFO  [SECURITY] AUTHORIZATION success userId=eve resource=/api/orders permission=READ
2026-04-26 10:35:07.555 ERROR [SECURITY] AUTHORIZATION failure userId=bob resource=/api/admin permission=ADMIN reason=Insufficient privileges
2026-04-26 10:35:07.666 INFO  [SECURITY] PASSWORD_CHANGED userId=charlie method=WEB ip=192.168.1.102
2026-04-26 10:35:07.777 WARN  [SECURITY] SESSION_TIMEOUT userId=diana sessionId=xyz789 duration=3600s
2026-04-26 10:35:07.888 INFO  [SECURITY] AUDIT_LOG action=ORDER_CREATE userId=eve orderId=40001 amount=75000
2026-04-26 10:35:07.999 ERROR [SECURITY] DATA_ACCESS_DENIED userId=bob resource=sensitive_data.csv action=EXPORT reason=Role mismatch
LOG

# 6. Generic format with stacktrace
cat > sample-log-06-gateway.log << 'LOG'
2026-04-26 10:40:08.111 INFO  API Gateway - Request received: GET /api/v1/products
2026-04-26 10:40:08.222 DEBUG API Gateway - Routing to service: ProductService
2026-04-26 10:40:08.333 INFO  API Gateway - Response sent: status=200, duration=122ms
2026-04-26 10:40:08.444 INFO  API Gateway - Request received: POST /api/v1/orders
2026-04-26 10:40:08.555 ERROR API Gateway - Service unavailable
	com.example.ServiceUnavailableException: ProductService is down
		at com.example.gateway.ServiceInvoker.invoke(ServiceInvoker.java:45)
		at com.example.gateway.GatewayController.handleRequest(GatewayController.java:78)
		at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)
		at java.base/java.lang.reflect.Method.invoke(Method.java:580)
		at org.springframework.web.method.support.InvocableHandlerMethod.doInvoke(InvocableHandlerMethod.java:205)
2026-04-26 10:40:08.666 WARN  API Gateway - Circuit breaker activated for ProductService
2026-04-26 10:40:08.777 INFO  API Gateway - Request received: GET /api/v1/health
2026-04-26 10:40:08.888 INFO  API Gateway - Health check passed
LOG

# 7. Exception log format (thread-first with detailed stacktraces)
cat > sample-log-07-exceptions.log << 'LOG'
2026-04-26 10:45:09.001 [main] INFO  ExceptionDemo.starting - Application starting
2026-04-26 10:45:09.111 [main] DEBUG ExceptionDemo.loadingConfig - Loading configuration from config.properties
2026-04-26 10:45:09.222 [main] ERROR ExceptionDemo.configError - Failed to load configuration
	java.io.FileNotFoundException: config.properties (No such file or directory)
		at java.base/java.io.FileInputStream.open0(Native Method)
		at java.base/java.io.FileInputStream.open(FileInputStream.java:219)
		at java.base/java.io.FileInputStream.<init>(FileInputStream.java:157)
		at com.example.ConfigLoader.load(ConfigLoader.java:34)
		at com.example.ExceptionDemo.starting(ExceptionDemo.java:25)
2026-04-26 10:45:09.333 [main] INFO  ExceptionDemo.usingDefaults - Using default configuration
2026-04-26 10:45:09.444 [task-scheduler-1] ERROR ExceptionDemo.taskFailed - Scheduled task failed
	java.lang.NullPointerException: Cannot invoke "List.size()" because "items" is null
		at com.example.TaskProcessor.process(TaskProcessor.java:56)
		at com.example.TaskProcessor$1.run(TaskProcessor.java:45)
		at java.base/java.util.Executors$RunnableAdapter.call(Executors.java:539)
		at java.base/java.util.concurrent.FutureTask.run(FutureTask.java:264)
		at java.base/java.util.concurrent.ScheduledThreadPoolExecutor$ScheduledFutureTask.run(ScheduledThreadPoolExecutor.java:304)
		at java.base/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1136)
		at java.base/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:635)
		at java.base/java.lang.Thread.run(Thread.java:840)
2026-04-26 10:45:09.555 [main] WARN  ExceptionDemo.highMemory - High memory usage detected: used=85%, max=1024MB
2026-04-26 10:45:09.666 [main] INFO  ExceptionDemo.shutdown - Application shutting down
LOG

# 8. Rolling file format with batch operations
cat > sample-log-08-batch.log << 'LOG'
2026-04-26 10:50:10.001 [batch-job-1] INFO  com.example.batch.OrderExportJob.start - Starting batch export: date=2026-04-26
2026-04-26 10:50:10.111 [batch-job-1] DEBUG com.example.batch.OrderExportJob.query - Executing query: SELECT * FROM orders WHERE created_at >= '2026-04-26'
2026-04-26 10:50:10.222 [batch-job-1] INFO  com.example.batch.OrderExportJob.progress - Export progress: processed=100, total=5000, percent=2%
2026-04-26 10:50:11.333 [batch-job-1] INFO  com.example.batch.OrderExportJob.progress - Export progress: processed=1000, total=5000, percent=20%
2026-04-26 10:50:11.444 [batch-job-1] WARN  com.example.batch.OrderExportJob.slowProgress - Export is slower than expected: elapsed=1144ms, eta=2856ms
2026-04-26 10:50:12.555 [batch-job-1] INFO  com.example.batch.OrderExportJob.progress - Export progress: processed=2500, total=5000, percent=50%
2026-04-26 10:50:13.666 [batch-job-1] INFO  com.example.batch.OrderExportJob.progress - Export progress: processed=4000, total=5000, percent=80%
2026-04-26 10:50:14.777 [batch-job-1] INFO  com.example.batch.OrderExportJob.complete - Export completed: outputFile=orders_2026-04-26.csv, records=5000, duration=4776ms
2026-04-26 10:50:14.888 [batch-job-1] INFO  com.example.batch.FileTransfer.upload - Starting file upload to S3: bucket=my-bucket, key=exports/orders_2026-04-26.csv
2026-04-26 10:50:15.999 [batch-job-1] INFO  com.example.batch.FileTransfer.upload - Upload completed: bytes=2456789, duration=1111ms
LOG

# 9. Microservice format with trace IDs
cat > sample-log-09-microservice.log << 'LOG'
2026-04-26 10:55:11.001 [INFO] [trace-id=abc123, span-id=def456] [OrderService] Creating order for user=eve
2026-04-26 10:55:11.111 [DEBUG] [trace-id=abc123, span-id=ghi789] [InventoryService] Checking inventory for ITEM-777
2026-04-26 10:55:11.222 [INFO] [trace-id=abc123, span-id=ghi789] [InventoryService] Inventory confirmed: available=50
2026-04-26 10:55:11.333 [INFO] [trace-id=abc123, span-id=jkl012] [PaymentService] Processing payment: amount=95000
2026-04-26 10:55:11.444 [ERROR] [trace-id=abc123, span-id=jkl012] [PaymentService] Payment gateway timeout
	java.util.concurrent.TimeoutException: Payment gateway did not respond within 5000ms
		at com.example.payment.PaymentGatewayClient.charge(PaymentGatewayClient.java:67)
		at com.example.payment.PaymentService.processPayment(PaymentService.java:89)
		at com.example.order.OrderService.createOrder(OrderService.java:56)
2026-04-26 10:55:11.555 [WARN] [trace-id=abc123, span-id=def456] [OrderService] Order creation failed: payment timeout, will retry
2026-04-26 10:55:12.666 [INFO] [trace-id=mno345, span-id=pqr678] [OrderService] Creating order for user=alice
2026-04-26 10:55:12.777 [INFO] [trace-id=mno345, span-id=stu901] [PaymentService] Payment successful: transactionId=txn_987654321
2026-04-26 10:55:12.888 [INFO] [trace-id=mno345, span-id=vwx234] [ShippingService] Shipment created: trackingId=SHIPPED-12345
LOG

# 10. Mixed format with various log levels
cat > sample-log-10-mixed.log << 'LOG'
2026-04-26 11:00:12.001 TRACE [main] com.example.Application.startup - Entry: Application.startup()
2026-04-26 11:00:12.002 DEBUG [main] com.example.Application.startup - System property: app.env=production
2026-04-26 11:00:12.003 INFO  [main] com.example.Application.startup - Application starting: version=2.1.0, build=20260426
2026-04-26 11:00:12.111 INFO  [main] com.example.ConfigLoader.load - Loading configuration from /etc/app/config.yml
2026-04-26 11:00:12.222 DEBUG [main] com.example.ConfigLoader.load - Config loaded: {database.url=jdbc:mysql://localhost:3306/mydb, cache.ttl=300}
2026-04-26 11:00:12.333 WARN  [main] com.example.ConfigLoader.load - Deprecated config key detected: old.cache.enabled, use new.cache.enabled instead
2026-04-26 11:00:12.444 INFO  [main] com.example.Database.connect - Connecting to database: jdbc:mysql://localhost:3306/mydb
2026-04-26 11:00:12.555 INFO  [main] com.example.Database.connect - Database connection established
2026-04-26 11:00:12.666 DEBUG [main] com.example.Database.getMetadata - Database version: MySQL 8.0.32
2026-04-26 11:00:12.777 INFO  [main] com.example.Cache.init - Cache initialized: maxSize=10000, ttl=300s
2026-04-26 11:00:12.888 INFO  [main] com.example.WebServer.start - Web server starting: port=8080
2026-04-26 11:00:13.999 INFO  [main] com.example.WebServer.start - Web server started: http://0.0.0.0:8080
2026-04-26 11:00:14.000 INFO  [main] com.example.Application.startup - Application started successfully in 1999ms
2026-04-26 11:00:15.111 TRACE [http-nio-8080-exec-1] com.example.web.UserController.login - Entry: login(userId=alice)
2026-04-26 11:00:15.222 DEBUG [http-nio-8080-exec-1] com.example.web.UserController.login - Authenticating user: alice
2026-04-26 11:00:15.333 INFO  [http-nio-8080-exec-1] com.example.web.UserController.login - User logged in: userId=alice, sessionId=ses_abc123
2026-04-26 11:00:15.444 TRACE [http-nio-8080-exec-1] com.example.web.UserController.login - Exit: login() - success
2026-04-26 11:00:16.555 WARN  [http-nio-8080-exec-2] com.example.web.ProductController.getProduct - Product not found: productId=ITEM-999
2026-04-26 11:00:17.666 ERROR [http-nio-8080-exec-3] com.example.web.OrderController.submit - Order submission failed
	java.lang.IllegalArgumentException: Invalid quantity: -1
		at com.example.validator.OrderValidator.validateQuantity(OrderValidator.java:23)
		at com.example.validator.OrderValidator.validate(OrderValidator.java:15)
		at com.example.web.OrderController.submit(OrderController.java:45)
LOG

echo "Generated 10 sample log files:"
ls -lh sample-log-*.log
