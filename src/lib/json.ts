export function advancedStringifyJson(obj: any) {
  return JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v);
}

// Deserialize
export function advancedParseJson(json: string) {
  return JSON.parse(json, (key, value) => {
    if (typeof value === "string" && /^\d+n$/.test(value)) {
      return BigInt(value.substr(0, value.length - 1));
    }
    return value;
  });
}
