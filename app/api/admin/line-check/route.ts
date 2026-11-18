import { withAdmin } from "@/lib/auth/withAdmin";
import { json } from "@/lib/http";
import { checkLineToken } from "@/lib/line/push";
import { getLineConfig } from "@/lib/line/config.server";

export const dynamic = "force-dynamic";

/** GET — is the LINE setup complete and does the token work? */
export const GET = withAdmin(async () => {
  const cfg = await getLineConfig();
  const token = await checkLineToken();
  return json({ ok: token.ok, liffId: cfg.liffId, channelId: cfg.channelId, token });
});
