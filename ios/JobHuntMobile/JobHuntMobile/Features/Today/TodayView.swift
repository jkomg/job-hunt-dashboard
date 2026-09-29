import SwiftUI

@MainActor
final class TodayViewModel: ObservableObject {
    @Published var items: [TodayQueueItem] = [
        TodayQueueItem(id: "1", title: "Follow up with Acme", subtitle: "Senior Product Designer", dueLabel: "Due today", kind: .followUp, isOverdue: false),
        TodayQueueItem(id: "2", title: "Prepare for interview", subtitle: "Northstar · Thursday at 10:00 AM", dueLabel: "Tomorrow", kind: .interview, isOverdue: false),
        TodayQueueItem(id: "3", title: "Apply to one saved role", subtitle: "Keep the pipeline moving", dueLabel: "This week", kind: .application, isOverdue: false)
    ]
    @Published var isLoading = false

    func refresh(using api: JobHuntAPIProtocol) async {
        isLoading = true
        defer { isLoading = false }
        if let remote = try? await api.todayQueue(), !remote.isEmpty { items = remote }
    }
}

struct TodayView: View {
    @EnvironmentObject private var appModel: AppModel
    @StateObject private var model = TodayViewModel()
    @State private var showingCapture = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Your next move")
                            .font(.title2.bold())
                        Text("A short list to keep your search moving today.")
                            .foregroundStyle(.secondary)
                        Button { showingCapture = true } label: {
                            Label("Capture a job", systemImage: "square.and.arrow.down")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(.vertical, 8)
                }

                Section("Today Queue") {
                    ForEach(model.items) { item in
                        QueueRow(item: item)
                    }
                }
            }
            .navigationTitle("Today")
            .refreshable { await model.refresh(using: appModel.api) }
            .sheet(isPresented: $showingCapture) { CaptureView() }
        }
    }
}

private struct QueueRow: View {
    let item: TodayQueueItem
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon).foregroundStyle(item.isOverdue ? .red : .blue)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title).font(.headline)
                Text(item.subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Text(item.dueLabel).font(.caption).foregroundStyle(item.isOverdue ? .red : .secondary)
        }
        .padding(.vertical, 5)
    }
    private var icon: String { switch item.kind { case .followUp: "arrow.turn.up.right"; case .interview: "person.crop.rectangle"; case .application: "paperplane"; case .networking: "person.2" } }
}
