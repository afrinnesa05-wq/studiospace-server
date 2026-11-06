import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksUrl = new URL(
  `${process.env.BETTER_AUTH_URL}/api/auth/jwks`
);

const JWKS = createRemoteJWKSet(jwksUrl);

export async function verifyAuth(req, res, next) {
  try {
    let token = null;

    // 1. First check Authorization header
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // 2. If Bearer token is not found, check Cookie
    if (!token) {
      const cookieHeader = req.headers.cookie || "";

      const cookies = Object.fromEntries(
        cookieHeader
          .split(";")
          .filter(Boolean)
          .map((cookie) => {
            const [name, ...value] = cookie.trim().split("=");
            return [name, value.join("=")];
          })
      );

      token = cookies["better-auth.session_data"];

      if (token) {
        token = decodeURIComponent(token);
      }
    }

    // 3. If no token found
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    // 4. Verify JWT using Better Auth JWKS
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ["EdDSA"],
    });

    const authUser = payload.user || payload;

    const userId = authUser.id || authUser.sub || payload.sub;
    const email = authUser.email || payload.email;
    const name = authUser.name || payload.name || email;

    if (!userId || !email) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user information is missing.",
      });
    }

    // 5. Attach authenticated user
    req.auth = payload;

    req.user = {
      id: userId,
      email: email.toLowerCase(),
      name,
    };

    next();

  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
}
