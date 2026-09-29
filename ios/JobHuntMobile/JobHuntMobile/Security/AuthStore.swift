import Foundation

@MainActor
final class AuthStore: ObservableObject {
    @Published private(set) var isAuthenticated: Bool
    private let keychain: KeychainStore

    init(keychain: KeychainStore = KeychainStore()) {
        self.keychain = keychain
        isAuthenticated = keychain.get("session") != nil
    }

    var cookieHeader: String? {
        guard let session = keychain.get("session") else { return nil }
        let csrf = keychain.get("csrf_token")
        return ["session=\(session)", csrf.map { "csrf_token=\($0)" }].compactMap { $0 }.joined(separator: "; ")
    }

    var csrfToken: String? { keychain.get("csrf_token") }

    func saveCookies(from response: HTTPURLResponse) throws {
        for raw in response.value(forHTTPHeaderField: "Set-Cookie")?.split(separator: ",") ?? [] {
            let pair = raw.split(separator: ";", maxSplits: 1).first.map(String.init) ?? ""
            let parts = pair.split(separator: "=", maxSplits: 1).map(String.init)
            guard parts.count == 2 else { continue }
            if parts[0] == "session" || parts[0] == "csrf_token" { try keychain.set(parts[1], for: parts[0]) }
        }
        guard keychain.get("session") != nil else { throw APIError.authenticationFailed }
        isAuthenticated = true
    }

    func clear() {
        keychain.deleteAll()
        isAuthenticated = false
    }
}
