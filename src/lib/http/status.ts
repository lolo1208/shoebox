export type StatusGroup = '1xx' | '2xx' | '3xx' | '4xx' | '5xx';

export interface HttpStatusEntry {
  code: number;
  /** 标准原因短语（RFC 9110 / IANA） */
  phrase: string;
  group: StatusGroup;
  zh: string;
  en: string;
}

const entry = (code: number, phrase: string, zh: string, en: string): HttpStatusEntry => ({
  code,
  phrase,
  group: `${Math.floor(code / 100)}xx` as StatusGroup,
  zh,
  en,
});

export const HTTP_STATUS_CODES: HttpStatusEntry[] = [
  // 1xx 信息
  entry(100, 'Continue', '服务器已收到请求头，客户端应继续发送请求体', 'Server received the headers; the client should continue with the body.'),
  entry(101, 'Switching Protocols', '服务器同意按 Upgrade 头切换协议（如升级到 WebSocket）', 'Server agrees to switch protocols as requested by the Upgrade header (e.g. WebSocket).'),
  entry(102, 'Processing', '服务器已收到并正在处理请求，但尚无结果（WebDAV）', 'Server received and is processing the request, but no result is available yet (WebDAV).'),
  entry(103, 'Early Hints', '在最终响应前提前返回响应头，常用于预加载资源', 'Early hints sent before the final response, typically used to preload resources.'),

  // 2xx 成功
  entry(200, 'OK', '请求成功，响应体中包含结果', 'The request succeeded and the body contains the result.'),
  entry(201, 'Created', '请求成功并创建了新资源，Location 头指向新资源', 'The request succeeded and a new resource was created; the Location header points to it.'),
  entry(202, 'Accepted', '请求已接受但尚未处理完成，适合异步任务', 'The request was accepted for processing but has not completed yet.'),
  entry(203, 'Non-Authoritative Information', '响应经过代理或缓存转换，并非原始服务器内容', 'The response was transformed by a proxy or cache, not by the origin server.'),
  entry(204, 'No Content', '成功但无响应体，常用于 DELETE / PUT', 'Success with no response body, common for DELETE or PUT.'),
  entry(205, 'Reset Content', '成功，并要求客户端重置文档视图或表单内容', 'Success; the client should reset the document view or form.'),
  entry(206, 'Partial Content', '返回部分内容，用于断点续传与分段下载', 'Partial content returned for range requests and resumable downloads.'),
  entry(207, 'Multi-Status', '多个资源操作结果的集合，响应体为 XML（WebDAV）', 'Multiple resource statuses returned in one XML body (WebDAV).'),
  entry(208, 'Already Reported', '同一集合的成员已在之前的 207 响应中报告过（WebDAV）', 'Members of a DAV binding were already reported in a previous 207 response.'),
  entry(226, 'IM Used', '服务器已完成对资源的一个或多个实例的操作（Delta 编码）', 'The server fulfilled a GET using delta encoding.'),

  // 3xx 重定向
  entry(300, 'Multiple Choices', '存在多个可选资源，客户端需要自行选择', 'Multiple representations are available; the client picks one.'),
  entry(301, 'Moved Permanently', '资源已永久移动，搜索引擎与书签应更新为新地址', 'The resource moved permanently; update links and bookmarks.'),
  entry(302, 'Found', '临时重定向，后续请求仍应使用原地址', 'Temporary redirect; keep using the original URL for future requests.'),
  entry(303, 'See Other', '请用 GET 访问另一个地址获取结果（PRG 模式）', 'Fetch the result from another URI with GET (Post/Redirect/Get).'),
  entry(304, 'Not Modified', '缓存仍然有效，无需重新传输，配合 ETag / Last-Modified 使用', 'The cached copy is still valid; used with ETag / Last-Modified.'),
  entry(305, 'Use Proxy', '必须通过指定代理访问该资源（已废弃，不要使用）', 'The resource must be accessed through the given proxy (deprecated).'),
  entry(307, 'Temporary Redirect', '临时重定向，且严格保持原请求方法与请求体', 'Temporary redirect that preserves the method and body.'),
  entry(308, 'Permanent Redirect', '永久重定向，且严格保持原请求方法与请求体', 'Permanent redirect that preserves the method and body.'),

  // 4xx 客户端错误
  entry(400, 'Bad Request', '请求语法错误或参数不合法，服务器无法解析', 'The request syntax or parameters are invalid and cannot be parsed.'),
  entry(401, 'Unauthorized', '未认证或凭证无效，需按 WWW-Authenticate 头提供凭证', 'Authentication is required or credentials are invalid (see WWW-Authenticate).'),
  entry(402, 'Payment Required', '保留状态码，部分 API 用来表示额度不足或需要付费', 'Reserved; some APIs use it for quota exhaustion or missing payment.'),
  entry(403, 'Forbidden', '已认证但没有访问权限，服务器拒绝执行', 'Authenticated but not allowed to access the resource.'),
  entry(404, 'Not Found', '资源不存在（也常用于隐藏资源是否真的存在）', 'The resource does not exist (also used to hide its existence).'),
  entry(405, 'Method Not Allowed', '请求方法不被该资源支持，响应含 Allow 头列出可用方法', 'The method is not supported for this resource; see the Allow header.'),
  entry(406, 'Not Acceptable', '无法生成符合 Accept 头要求的响应内容', 'Cannot produce a response matching the Accept header.'),
  entry(407, 'Proxy Authentication Required', '需要先通过代理服务器认证', 'The client must authenticate with the proxy first.'),
  entry(408, 'Request Timeout', '客户端在服务器等待时间内没有完成请求', 'The client did not send the full request within the wait time.'),
  entry(409, 'Conflict', '请求与资源当前状态冲突（如并发写入、版本冲突）', 'The request conflicts with the current state of the resource.'),
  entry(410, 'Gone', '资源已被永久删除，且不会再提供', 'The resource was permanently removed and will not be available again.'),
  entry(411, 'Length Required', '缺少必需的 Content-Length 请求头', 'The Content-Length header is required.'),
  entry(412, 'Precondition Failed', 'If-Match / If-Unmodified-Since 等前提条件不成立', 'A precondition such as If-Match or If-Unmodified-Since failed.'),
  entry(413, 'Content Too Large', '请求体超过服务器允许的最大大小', 'The request body exceeds the size the server accepts.'),
  entry(414, 'URI Too Long', '请求的 URI 过长，服务器拒绝处理', 'The request URI is too long for the server to process.'),
  entry(415, 'Unsupported Media Type', '请求体的媒体类型不受服务器支持', 'The request body media type is not supported.'),
  entry(416, 'Range Not Satisfiable', 'Range 请求范围无效或超出资源大小', 'The requested range cannot be satisfied.'),
  entry(417, 'Expectation Failed', '无法满足 Expect 请求头中提出的要求', 'The Expect header requirement cannot be met.'),
  entry(418, "I'm a teapot", '来自 HTCPCP 协议的玩笑状态码，部分服务用作彩蛋', 'Joke status code from HTCPCP (RFC 2324); sometimes used as an easter egg.'),
  entry(421, 'Misdirected Request', '请求被发送到了无法为该源生成响应的服务器', 'The request was directed at a server that cannot produce a response for it.'),
  entry(422, 'Unprocessable Content', '格式正确但语义错误，服务器无法处理其中内容', 'Well-formed request but semantically invalid content.'),
  entry(423, 'Locked', '资源被锁定，无法访问（WebDAV）', 'The target resource is locked (WebDAV).'),
  entry(424, 'Failed Dependency', '由于前一个请求失败导致当前请求失败（WebDAV）', 'The request failed because a previous request failed (WebDAV).'),
  entry(425, 'Too Early', '服务器不愿处理可能被重放的早期请求，防止重放攻击', 'The server refuses to process a request that may be replayed.'),
  entry(426, 'Upgrade Required', '客户端需要先升级到其他协议再重试', 'The client must upgrade to another protocol before retrying.'),
  entry(428, 'Precondition Required', '服务器要求请求带条件头，避免丢失更新', 'The server requires conditional headers to avoid lost updates.'),
  entry(429, 'Too Many Requests', '请求过于频繁，触发限流，注意 Retry-After 头', 'Too many requests; rate limit exceeded (see Retry-After).'),
  entry(431, 'Request Header Fields Too Large', '单个或全部请求头字段过大', 'A header field or the whole header section is too large.'),
  entry(451, 'Unavailable For Legal Reasons', '因法律原因不可用（如审查、版权或制裁）', 'Unavailable for legal reasons such as censorship or copyright.'),

  // 5xx 服务端错误
  entry(500, 'Internal Server Error', '服务器内部错误，无法完成请求', 'An unexpected condition prevented the server from fulfilling the request.'),
  entry(501, 'Not Implemented', '服务器不支持该请求方法或功能', 'The server does not support the request method or the required functionality.'),
  entry(502, 'Bad Gateway', '网关或代理从上游服务器收到无效响应', 'The gateway or proxy received an invalid response from the upstream server.'),
  entry(503, 'Service Unavailable', '服务暂时不可用（过载或维护），通常会带 Retry-After', 'The service is temporarily unavailable (overload or maintenance).'),
  entry(504, 'Gateway Timeout', '网关或代理等待上游响应超时', 'The gateway or proxy timed out waiting for the upstream server.'),
  entry(505, 'HTTP Version Not Supported', '服务器不支持请求中使用的 HTTP 版本', 'The HTTP version used in the request is not supported.'),
  entry(506, 'Variant Also Negotiates', '内容协商配置错误导致循环引用', 'Transparent content negotiation is misconfigured, causing a loop.'),
  entry(507, 'Insufficient Storage', '服务器存储空间不足，无法保存请求内容（WebDAV）', 'The server cannot store the representation needed to complete the request (WebDAV).'),
  entry(508, 'Loop Detected', '服务器检测到无限循环（WebDAV）', 'The server detected an infinite loop while processing the request (WebDAV).'),
  entry(510, 'Not Extended', '需要对请求做进一步扩展服务器才愿意处理', 'Further extensions to the request are required.'),
  entry(511, 'Network Authentication Required', '需要先完成网络认证（如公共 WiFi 登录门户）', 'The client must authenticate to gain network access (e.g. captive portal).'),
];

export const STATUS_GROUPS: StatusGroup[] = ['1xx', '2xx', '3xx', '4xx', '5xx'];

export const GROUP_LABEL: Record<StatusGroup, { zh: string; en: string }> = {
  '1xx': { zh: '信息响应', en: 'Informational' },
  '2xx': { zh: '成功', en: 'Success' },
  '3xx': { zh: '重定向', en: 'Redirection' },
  '4xx': { zh: '客户端错误', en: 'Client Error' },
  '5xx': { zh: '服务器错误', en: 'Server Error' },
};

/** 状态码分组的 Tailwind 样式 */
export const GROUP_STYLE: Record<StatusGroup, { badge: string; dot: string }> = {
  '1xx': { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  '2xx': { badge: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  '3xx': { badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  '4xx': { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  '5xx': { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};
