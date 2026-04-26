#!/bin/bash
cd /home/keehyun/dev/analyze-log/sample

# LogStorm.java 컴파일
javac LogStorm.java

# 10개의 로그 파일 생성 (각 3-5초 실행)
for i in {1..10}; do
    echo "Generating sample log $i..."
    timeout $((3 + RANDOM % 3)) java LogStorm > "sample-log-${i}.log" 2>&1
    sleep 0.5
done

echo "Generated 10 sample log files:"
ls -lh sample-log-*.log
