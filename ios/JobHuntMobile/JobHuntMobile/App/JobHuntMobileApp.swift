import SwiftUI

@main
struct JobHuntMobileApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
        }
    }
}

@MainActor
final class AppModel: ObservableObject {
    let api: JobHuntAPI
    let store: LocalDraftStore

    init(api: JobHuntAPI = .live, store: LocalDraftStore = LocalDraftStore()) {
        self.api = api
        self.store = store
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
            PipelineView()
                .tabItem { Label("Pipeline", systemImage: "rectangle.stack.fill") }
        }
    }
}
