import SwiftUI

@main
struct JobHuntMobileApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .onOpenURL { appModel.receiveCaptureURL($0) }
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    let api: JobHuntAPI
    let store: LocalDraftStore
    let auth: AuthStore
    @Published var incomingCapture: CapturePayload?

    init(api: JobHuntAPI? = nil, store: LocalDraftStore = LocalDraftStore(), auth: AuthStore = AuthStore()) {
        self.auth = auth
        self.api = api ?? .live(auth: auth)
        self.store = store
        incomingCapture = nil
    }

    func signIn(username: String, password: String) async throws {
        try await api.login(username: username, password: password)
        objectWillChange.send()
    }

    func signOut() async {
        try? await api.logout()
        auth.clear()
        objectWillChange.send()
    }

    func receiveCaptureURL(_ url: URL) {
        guard url.scheme == "jobhunt" else { return }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let text = components?.queryItems?.first(where: { $0.name == "text" })?.value ?? ""
        let sharedURL = components?.queryItems?.first(where: { $0.name == "url" })?.value.flatMap(URL.init)
        incomingCapture = CapturePayload(text: text, url: sharedURL)
    }
}

struct CapturePayload: Identifiable {
    let id = UUID()
    let text: String
    let url: URL?
}

struct RootView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        Group {
            if appModel.auth.isAuthenticated {
                TabView {
                    TodayView()
                        .tabItem { Label("Today", systemImage: "sun.max.fill") }
                    PipelineView()
                        .tabItem { Label("Pipeline", systemImage: "rectangle.stack.fill") }
                }
                .sheet(item: $appModel.incomingCapture) { payload in
                    CaptureView(initialText: payload.text, initialURL: payload.url)
                }
            } else {
                LoginView()
            }
        }
    }
}
