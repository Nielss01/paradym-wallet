function getVerifiedCredentialsDeeplink() {
  const body = JSON.stringify({
    presentationDefinitionId: "019368ed-3787-7669-b7f4-8c012238e90d__0",
    requestScheme: "openid4vp://",
    responseMode: "direct_post.jwt",
    requestSignerType: "x5c",
    transactionAuthorizationType: "none",
    version: "v1.draft24",
    queryLanguage: "dcql",
  });

  const response = http.post(requestUrl, {
    headers: { "Content-Type": "application/json" },
    body: body
  });

  const data = json(response.body);

  if (!data) {
    throw new Error("Empty response from verification request");
  }

  const directUri =
    data.authorizationRequestUri || data.authorization_request_uri;

  if (directUri) {
    return directUri;
  }

  const aro =
    data.authorizationRequestObject || data.authorization_request_object;

  if (!aro) {
    throw new Error(
      "authorizationRequestUri and authorizationRequestObject missing"
    );
  }

  const clientId = aro.client_id;
  const requestUri = aro.request_uri;

  if (!clientId || !requestUri) {
    throw new Error(
      "client_id or request_uri missing in authorizationRequestObject"
    );
  }

  const scheme = "openid4vp://";

  return (
    scheme +
    "?client_id=" +
    encodeURIComponent(clientId) +
    "&request_uri=" +
    encodeURIComponent(requestUri)
  );
}

output.verificationDeeplink = getVerifiedCredentialsDeeplink();
