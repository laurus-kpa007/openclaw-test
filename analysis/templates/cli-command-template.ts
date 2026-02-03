/**
 * OpenClaw CLI Command Template
 *
 * 이 템플릿을 사용하여 새로운 CLI 명령을 추가하세요.
 *
 * 사용 방법:
 * 1. 이 파일을 복사: src/cli/program/register.<command>.ts
 * 2. 모든 TODO 주석을 찾아서 구현
 * 3. build-program.ts에 명령 등록
 *
 * @author Your Name
 * @version 1.0.0
 */

import type { Command } from "commander";
import type { CliDeps } from "../deps.js";
import { createDefaultDeps } from "../deps.js";
import { loadConfig } from "../../config/config.js";

// TODO: 명령 옵션 타입 정의
export type MyCommandOpts = {
  // 필수 옵션
  input?: string;

  // 선택 옵션
  output?: string;
  format?: "json" | "yaml" | "table";
  verbose?: boolean;

  // Flag 옵션
  dryRun?: boolean;
  force?: boolean;

  // TODO: 추가 옵션 정의
};

/**
 * 명령 실행 함수
 */
export async function myCommand(
  opts: MyCommandOpts,
  deps: CliDeps = createDefaultDeps()
): Promise<void> {
  // TODO: 1. 옵션 검증
  if (!opts.input) {
    throw new Error("--input is required");
  }

  // TODO: 2. 설정 로드 (필요 시)
  const cfg = loadConfig();

  // TODO: 3. 초기 메시지
  if (opts.verbose) {
    console.log(`Running my-command with options:`, opts);
  }

  // TODO: 4. Dry run 체크
  if (opts.dryRun) {
    console.log("Dry run mode - no changes will be made");
  }

  try {
    // TODO: 5. 주요 로직 구현
    const result = await executeMyCommand(opts, cfg);

    // TODO: 6. 결과 출력
    const output = formatOutput(result, opts.format ?? "table");

    // TODO: 7. 파일 저장 또는 콘솔 출력
    if (opts.output) {
      await saveOutput(opts.output, output);
      console.log(`Result saved to: ${opts.output}`);
    } else {
      console.log(output);
    }

    // TODO: 8. 성공 메시지
    if (opts.verbose) {
      console.log("✅ Command completed successfully");
    }
  } catch (error) {
    // TODO: 9. 에러 핸들링
    console.error("❌ Error:", error instanceof Error ? error.message : String(error));

    if (opts.verbose && error instanceof Error && error.stack) {
      console.error("Stack trace:", error.stack);
    }

    throw error;
  }
}

/**
 * TODO: 실제 명령 로직 구현
 */
async function executeMyCommand(opts: MyCommandOpts, cfg: any): Promise<any> {
  // TODO: 구현
  // 예시:
  // - 파일 읽기
  // - API 호출
  // - 데이터 처리
  // - 결과 반환

  return {
    status: "success",
    data: {
      // TODO: 결과 데이터
    },
  };
}

/**
 * TODO: 출력 포맷 함수
 */
function formatOutput(result: any, format: string): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  if (format === "yaml") {
    // TODO: YAML 변환
    return "# YAML output\n" + JSON.stringify(result, null, 2);
  }

  // Table 포맷 (기본)
  let output = "\n";
  output += "═".repeat(60) + "\n";
  output += "  My Command Result\n";
  output += "═".repeat(60) + "\n\n";

  // TODO: 테이블 포맷 구현
  output += `Status: ${result.status}\n`;
  output += "\n";

  return output;
}

/**
 * TODO: 파일 저장 함수
 */
async function saveOutput(path: string, content: string): Promise<void> {
  const fs = await import("node:fs/promises");
  await fs.writeFile(path, content, "utf-8");
}

/**
 * 명령 등록 함수
 */
export function registerMyCommand(program: Command) {
  program
    .command("my-command")
    .description("Brief description of what this command does")
    .option("-i, --input <path>", "Input file path (required)")
    .option("-o, --output <path>", "Output file path")
    .option("-f, --format <format>", "Output format (json|yaml|table)", "table")
    .option("-v, --verbose", "Verbose output")
    .option("--dry-run", "Dry run mode")
    .option("--force", "Force execution")
    .action(async (opts: MyCommandOpts) => {
      try {
        await myCommand(opts);
      } catch (error) {
        console.error(error);
        process.exit(1);
      }
    });
}

/**
 * SubCLI 등록 (복잡한 명령의 경우)
 *
 * 사용 예:
 * - openclaw my-command sub1
 * - openclaw my-command sub2 --option
 */
export function registerMyCommandGroup(program: Command) {
  const myCmd = program
    .command("my-command")
    .description("Group of related commands");

  // Subcommand 1
  myCmd
    .command("sub1")
    .description("Subcommand 1 description")
    .option("--option1 <value>", "Option 1")
    .action(async (opts) => {
      console.log("Executing sub1 with options:", opts);
      // TODO: sub1 로직
    });

  // Subcommand 2
  myCmd
    .command("sub2")
    .description("Subcommand 2 description")
    .option("--option2 <value>", "Option 2")
    .action(async (opts) => {
      console.log("Executing sub2 with options:", opts);
      // TODO: sub2 로직
    });

  // Subcommand 3 (with arguments)
  myCmd
    .command("sub3 <arg1> [arg2]")
    .description("Subcommand 3 with arguments")
    .action(async (arg1, arg2, opts) => {
      console.log("Executing sub3 with:", { arg1, arg2, opts });
      // TODO: sub3 로직
    });
}

/**
 * TODO Checklist:
 *
 * [ ] MyCommandOpts 타입 정의
 * [ ] myCommand 함수 구현
 * [ ] executeMyCommand 로직 구현
 * [ ] formatOutput 함수 구현
 * [ ] saveOutput 함수 구현 (필요 시)
 * [ ] 옵션 검증 로직
 * [ ] 에러 핸들링
 * [ ] verbose 모드 지원
 * [ ] dry-run 모드 지원 (필요 시)
 * [ ] 테스트 작성
 * [ ] build-program.ts에 등록
 * [ ] 문서 작성 (--help 텍스트)
 */

/**
 * 사용 예시 (등록 후):
 *
 * ```bash
 * # 기본 사용
 * openclaw my-command --input input.txt
 *
 * # 출력 파일 지정
 * openclaw my-command --input input.txt --output result.json
 *
 * # JSON 포맷으로 출력
 * openclaw my-command --input input.txt --format json
 *
 * # Verbose 모드
 * openclaw my-command --input input.txt --verbose
 *
 * # Dry run
 * openclaw my-command --input input.txt --dry-run
 *
 * # SubCLI 사용
 * openclaw my-command sub1 --option1 value
 * openclaw my-command sub2 --option2 value
 * openclaw my-command sub3 arg1 arg2
 * ```
 */
