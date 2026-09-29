import Foundation

@MainActor
protocol JobHuntAPIProtocol {
    func todayQueue() async throws -> [TodayQueueItem]
    func pipeline() async throws -> [PipelineEntry]
    func createPipelineEntry(from draft: JobDraft, mutationID: String) async throws
}

@MainActor
struct JobHuntAPI: JobHuntAPIProtocol {
    static let live = JobHuntAPI(baseURL: JobHuntAPI.defaultBaseURL)

    let baseURL: URL
    private let session: URLSession
    private let auth: AuthStore

    init(baseURL: URL, session: URLSession = .shared, auth: AuthStore = AuthStore()) {
        self.baseURL = baseURL
        self.session = session
        self.auth = auth
    }

    static func live(auth: AuthStore) -> JobHuntAPI {
        JobHuntAPI(baseURL: defaultBaseURL, auth: auth)
    }

    private static var defaultBaseURL: URL {
        let configured = Bundle.main.object(forInfoDictionaryKey: "JobHuntAPIBaseURL") as? String
        return URL(string: configured ?? "http://127.0.0.1:3001")!
    }

    func login(username: String, password: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["username": username, "password": password])
        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.authenticationFailed }
        try auth.saveCookies(from: http)
    }

    func logout() async throws {
        var request = makeRequest(path: "/api/logout", method: "POST")
        request.setValue(auth.csrfToken, forHTTPHeaderField: "X-CSRF-Token")
        _ = try await send(request)
    }

    func todayQueue() async throws -> [TodayQueueItem] {
        let response: DashboardResponse = try await get("/api/dashboard")
        return response.queue
    }

    func pipeline() async throws -> [PipelineEntry] {
        try await get("/api/pipeline")
    }

    func createPipelineEntry(from draft: JobDraft, mutationID: String) async throws {
        var request = makeRequest(path: "/api/pipeline", method: "POST")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(mutationID, forHTTPHeaderField: "X-Mobile-Mutation-ID")
        request.setValue(auth.csrfToken, forHTTPHeaderField: "X-CSRF-Token")
        request.httpBody = try JSONEncoder().encode([
            "Company": draft.company, "Role": draft.role, "Job URL": draft.url,
            "Location": draft.location, "Notes": draft.notes,
            "Skills": draft.skills.joined(separator: ", ")
        ])
        _ = try await send(request)
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        let request = makeRequest(path: path, method: "GET")
        return try await decode(T.self, from: request)
    }

    private func makeRequest(path: String, method: String) -> URLRequest {
        var request = URLRequest(url: baseURL.appendingPathComponent(String(path.dropFirst())))
        request.httpMethod = method
        request.setValue(auth.cookieHeader, forHTTPHeaderField: "Cookie")
        return request
    }

    private func decode<T: Decodable>(_ type: T.Type, from request: URLRequest) async throws -> T {
        let data = try await send(request)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func send(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw APIError.httpStatus(http.statusCode) }
        return data
    }
}

private struct DashboardResponse: Decodable {
    let queue: [TodayQueueItem]

    enum CodingKeys: String, CodingKey { case queue = "todayQueue" }
}

enum APIError: LocalizedError {
    case invalidResponse, httpStatus(Int), authenticationFailed
    var errorDescription: String? {
        switch self {
        case .invalidResponse: "The server returned an invalid response"
        case .httpStatus(let code): "Server error (\(code))"
        case .authenticationFailed: "Sign in failed. Check your credentials and try again."
        }
    }
}
