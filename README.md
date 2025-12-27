## Node.js Observability-ready Server Template

### 이 프로젝트는 Node.js 기반 서버 템플릿으로, 초기부터 로깅·메트릭·모니터링(Observability) 을 고려한 구조를 제공합니다.

    •	Express 기반 API 서버
    •	Prometheus 메트릭 수집
    •	Grafana 시각화
    •	Loki + Promtail 로그 수집
    •	Docker Compose 기반 관측 스택 구성

```
node_template/
├── app/
│   ├── src/
│   │   ├── core/
│   │   │   ├── config/
│   │   │   │   └── env.js
│   │   │   ├── logger.js
│   │   │   └── metrics/
│   │   │       └── metrics.js
│   │   │
│   │   ├── middleware/
│   │   │   ├── request_logger.js
│   │   │   └── error_handler.js
│   │   │
│   │   ├── modules/
│   │   │   └── health/
│   │   │       └── health.controller.js
│   │   │
│   │   ├── routes/
│   │   │   └── index.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   ├── logs/
│   │   └── app.log
│   │
│   └── package.json
│
├── observability/
│   ├── docker-compose.yml
│   │
│   ├── grafana/
│   │   └── data/
│   │
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── data/
│   │
│   ├── loki/
│   │   ├── config.yaml
│   │   └── data/
│   │
│   └── promtail/
│       └── config.yaml
│
└── README.md
```

### Prometheus

역할
• 애플리케이션의 메트릭(metrics) 을 주기적으로 수집하는 시계열 데이터베이스

주요 설정
• prometheus/prometheus.yml
• scrape_configs에서 Node 서버의 /metrics 엔드포인트 설정
• 예: http://host.docker.internal:3000/metrics

확인 주소
• 웹 UI: http://localhost:9090
• Targets 상태 확인:
Status → Targets

### Grafana

역할
• Prometheus / Loki 데이터를 대시보드로 시각화하는 UI 도구

주요 설정
• 데이터는 grafana/data/에 저장 (컨테이너 재시작 시 유지)
• Data Source로 Prometheus, Loki 연결

확인 주소
• 웹 UI: http://localhost:3001
• 기본 계정:
• ID: admin
• PW: admin

### Loki

역할
• 애플리케이션 로그를 저장·검색하는 로그 전용 스토리지

주요 설정
• loki/config.yaml
• 파일 기반 스토리지 사용
• 로그 데이터는 loki/data/에 저장
• 직접 로그를 받지 않고 Promtail을 통해서만 수집

확인 주소
• 헬스 체크: http://localhost:3100/ready
• (UI는 없음, Grafana에서 조회)

### Promtail

역할
• 서버에서 생성된 로그 파일을 읽어 Loki로 전송하는 에이전트

주요 설정
• promtail/config.yaml
• **path**로 수집할 로그 파일 경로 지정
• 예: /app/logs/\*.log
• Loki 서버 주소:

```
url: http://loki:3100/loki/api/v1/push
```

확인 방법
• Grafana → Explore → Loki
• 쿼리 예:

```
{job="node-app"}
```

### 컨테이너 실행 방법

```
cd observability
docker compose up -d
```
