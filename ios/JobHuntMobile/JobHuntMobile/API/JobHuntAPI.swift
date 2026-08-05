import Foundation

@MainActor
protocol JobHuntAPIProtocol {
    func todayQueue() async throws -> [TodayQueueItem]
    func pipeline() async throws -> [PipelineEntry]
    func createPipelineEntry(from draft: JobDraft, mutationID: String) async throws
}

@MainActor
struct JobHuntAPI: JobHuntAPIProtocol {
    static let live = JobHuntAPI(baseURL: URL(string: "https://replace-with-hosted-job-hunt.example")!)

    let baseURL: URL
    private let session: URLSession

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    func todayQueue() async throws -> [TodayQueueItem] {
        let response: DashboardResponse = try await get("/api/dashboard")
        return response.queue
    }

    func pipeline() async throws -> [PipelineEntry] {
        try await get("/api/pipeline")
    }

    func createPipelineEntry(from draft: JobDraft, mutationID: String) async throws {
        var request = URLRequest(url: baseURL.appendingPathComponent("api/pipeline"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(mutationID, forHTTPHeaderField: "X-Mobile-Mutation-ID")
        request.httpBody = try JSONEncoder().encode([
            "Company": draft.company, "Role": draft.role, "Job URL": draft.url,
            "Location": draft.location, "Notes": draft.notes,
            "Skills": draft.skills.joined(separator: ", ")
        ])
        _ = try await send(request)
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(String(path.dropFirst())))
        request.httpMethod = "GET"
        return try await decode(T.self, from: request)
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
    case invalidResponse, httpStatus(Int)
    var errorDescription: String? {
        switch self { case .invalidResponse: "The server returned an invalid response"; case .httpStatus(let code): "Server error (\(code))" }
    }
}
