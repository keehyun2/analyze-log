function gt {
    param(
        [string]$mode = "s"
    )
    
    switch ($mode) {
        "g" {  # GLM 모드 (Z.ai)
            $env:ANTHROPIC_AUTH_TOKEN = "b5e84d0ee2904a53a114d5a2ecbc48ea.YVc3MnZKCAPwLsIL"
            $env:ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic"
            $env:ANTHROPIC_VERSION = "2023-06-01"
            $env:API_TIMEOUT_MS = "3000000"
            $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "glm-4.5-air"
            $env:ANTHROPIC_DEFAULT_SONNET_MODEL = "glm-4.7"
            $env:ANTHROPIC_DEFAULT_OPUS_MODEL = "glm-5.1"
            Write-Host "🔹 GLM 모드 활성화 (현재 터미널만)" -ForegroundColor Cyan
        }
        "c" {  # Claude 모드 (Anthropic)
            Remove-Item Env:\ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue
            Remove-Item Env:\ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue
            Remove-Item Env:\ANTHROPIC_VERSION -ErrorAction SilentlyContinue
            Remove-Item Env:\API_TIMEOUT_MS -ErrorAction SilentlyContinue
            Remove-Item Env:\ANTHROPIC_DEFAULT_HAIKU_MODEL -ErrorAction SilentlyContinue
            Remove-Item Env:\ANTHROPIC_DEFAULT_SONNET_MODEL -ErrorAction SilentlyContinue
            Remove-Item Env:\ANTHROPIC_DEFAULT_OPUS_MODEL -ErrorAction SilentlyContinue
            Write-Host "🔸 Claude 모드 활성화 (현재 터미널만)" -ForegroundColor Yellow
        }
        { $_ -in "s", "" } {  # 상태 확인
            if ($env:ANTHROPIC_BASE_URL -like "*z.ai*") {
                Write-Host "🔹 현재: GLM ($env:ANTHROPIC_DEFAULT_SONNET_MODEL)" -ForegroundColor Cyan
            } else {
                Write-Host "🔸 현재: Claude (Anthropic 기본)" -ForegroundColor Yellow
            }
        }
        default {
            Write-Host "사용법: gt [g|c|s]"
            Write-Host "  g - GLM 모드"
            Write-Host "  c - Claude 모드"
            Write-Host "  s - 상태 확인 (기본)"
        }
    }
}

if ($args.Count -gt 0) {
    gt $args[0]
} else {
    gt
}
