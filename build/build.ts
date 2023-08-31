import * as colors from "https://deno.land/std@0.200.0/fmt/colors.ts"
import { encodeHex } from "https://deno.land/x/hexes@v0.1.0/encode.ts"
import { codegen } from "./codegen.ts"

interface BuildProps {
  watPath: string
  wabtArgs: string[]
  dynamic: boolean
  check: boolean
}

export async function build({ watPath, wabtArgs, dynamic, check }: BuildProps): Promise<boolean> {
  const wasmCmd = await new Deno.Command("wat2wasm", {
    args: [watPath, ...wabtArgs, "--output=-"],
    stdout: "piped",
    stderr: "piped",
    stdin: "null",
    env: {
      FORCE_COLOR: colors.getColorEnabled() ? "1" : "0",
    },
  }).output()

  if (!wasmCmd.success) {
    console.log(tag("error", colors.bgRed), watPath)
    console.log(new TextDecoder().decode(wasmCmd.stderr).replace(/^/gm, "  "))
    return false
  }

  const wasm = wasmCmd.stdout
  const code = codegen(wasm, dynamic)

  const hash = encodeHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))),
  )
  const generated = `@generated ${hash}`

  const outputPath = watPath + ".ts"
  const existing = await Deno.readTextFile(outputPath).catch(() => "")
  const clean = existing.includes(generated)

  const byteCount = colors.gray(`(${wasm.length} bytes)`)

  if (check) {
    if (clean) {
      console.log(tag("clean", colors.bgBrightGreen), outputPath, byteCount)
    } else {
      console.log(tag("dirty", colors.bgBrightRed), outputPath)
    }
    return clean
  } else {
    if (clean) {
      console.log(tag("clean", colors.bgBrightBlack), outputPath, byteCount)
    } else {
      const file = `// ${generated}\n\n${code}`
      await Deno.writeTextFile(outputPath, file)
      console.log(tag("built", colors.bgBlue), outputPath, byteCount)
    }
    return true
  }
}

function tag(label: string, bgColor: (text: string) => string) {
  return colors.bold(bgColor(` ${label.toUpperCase()} `))
}
