// src/hooks/useCollisionDetection.ts

import { useCallback } from 'react';
import { LocalDetectedObject } from '../types'; // Đảm bảo đường dẫn đúng đến types của bạn

// Định nghĩa interface cho kết quả va chạm
export interface CollisionResult {
    groundY: number;
    polygon: LocalDetectedObject;
}

// Cấu hình cho logic va chạm
interface CollisionDetectionConfig {
    charWidth: number;
    charHeight: number;
    collisionThresholdUp: number; // Ngưỡng vượt qua khi đi lên dốc (để nhân vật không bị kẹt)
    collisionThresholdDown: number; // Ngưỡng dưới để bắt va chạm sớm hơn một chút (để va chạm mượt hơn)
}

/**
 * Custom hook để xử lý logic phát hiện va chạm với các polygon.
 * Hook này trả về một hàm `checkGroundCollision` đã được tối ưu hóa bằng `useCallback`.
 *
 * @param objects Mảng các LocalDetectedObject (polygons) để kiểm tra va chạm.
 * @param viewScale Tỷ lệ phóng đại hiện tại của khung hình game (ví dụ: background.width / container.width).
 * @param viewWidth Chiều rộng của khu vực render game (chiều rộng của background đã scale).
 * @param viewHeight Chiều cao của khu vực render game (chiều cao của background đã scale).
 * @param config Cấu hình va chạm bao gồm kích thước nhân vật và các ngưỡng va chạm.
 * @returns Một đối tượng chứa hàm `checkGroundCollision`.
 */
export const useCollisionDetection = (
    objects: LocalDetectedObject[],
    viewScale: number,
    viewWidth: number,
    viewHeight: number,
    config: CollisionDetectionConfig
) => {
    const { charWidth, charHeight, collisionThresholdUp, collisionThresholdDown } = config;

    const checkGroundCollision = useCallback((currX: number, currY: number): CollisionResult | null => {
        let minGroundY: number | null = null;
        let collidedPolygon: LocalDetectedObject | null = null;

        // Tọa độ chân của nhân vật (điểm giữa phía dưới)
        const footX = currX + charWidth / 2;
        const footY = currY + charHeight;

        for (const obj of objects) { // Lặp qua tất cả các đối tượng (polygon) có thể va chạm
            const poly = obj.polygon; // Polygon gốc (tọa độ chưa scale)
            // Scale polygon ngay tại đây để kiểm tra va chạm trong không gian hiển thị
            const scaledPoly = poly.map(p => [p[0] * viewScale, p[1] * viewScale]);

            // Kiểm tra va chạm với từng cạnh của polygon
            for (let i = 0; i < scaledPoly.length; i++) {
                const p1 = scaledPoly[i];
                const p2 = scaledPoly[(i + 1) % scaledPoly.length]; // Cạnh nối p1 và p2

                // Chỉ xem xét các cạnh mà chân nhân vật có thể "đứng" trên đó (nằm giữa x của p1 và p2)
                const minEdgeX = Math.min(p1[0], p2[0]);
                const maxEdgeX = Math.max(p1[0], p2[0]);

                if (footX >= minEdgeX && footX <= maxEdgeX) {
                    // Tránh chia cho 0 nếu đoạn thẳng đứng (deltaX = 0)
                    if (Math.abs(p2[0] - p1[0]) > 0.001) {
                        const slope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
                        const yOnLine = p1[1] + slope * (footX - p1[0]); // Y của đường thẳng tại vị trí X của chân nhân vật

                        // Kiểm tra xem chân nhân vật có nằm trong ngưỡng va chạm với đường thẳng này không
                        if (footY >= yOnLine - collisionThresholdDown && footY <= yOnLine + collisionThresholdUp) {
                            // Nếu đây là điểm va chạm cao nhất (gần mặt đất nhất) hoặc va chạm đầu tiên
                            if (minGroundY === null || yOnLine < minGroundY) {
                                minGroundY = yOnLine;
                                collidedPolygon = obj; // Lưu trữ đối tượng gốc đã va chạm
                            }
                        }
                    }
                }
            }
        }

        // --- Xử lý sàn mặc định nếu không có polygon nào được phát hiện ---
        if (minGroundY === null) {
            const floorY = viewHeight - 20; // Giả định vị trí sàn mặc định trong không gian hiển thị
            // Kiểm tra xem chân nhân vật có chạm sàn mặc định không
            if (footY >= floorY - collisionThresholdDown && footY <= floorY + collisionThresholdUp) {
                // Tạo một đối tượng giả định cho sàn mặc định
                const defaultFloorObject: LocalDetectedObject = {
                    id: 'default-floor',
                    name: 'Default Floor',
                    // Chuyển đổi tọa độ polygon về "không gian gốc" (chưa scale) để lưu trữ nhất quán
                    polygon: [[0, floorY / viewScale], [viewWidth / viewScale, floorY / viewScale], [viewWidth / viewScale, (floorY + 50) / viewScale], [0, (floorY + 50) / viewScale]],
                    bbox: [0, floorY / viewScale, viewWidth / viewScale, (floorY + 50) / viewScale]
                };
                minGroundY = floorY;
                collidedPolygon = defaultFloorObject;
            }
        }

        if (minGroundY !== null && collidedPolygon !== null) {
            return { groundY: minGroundY, polygon: collidedPolygon };
        }
        return null;
    }, [objects, viewScale, viewWidth, viewHeight, charWidth, charHeight, collisionThresholdUp, collisionThresholdDown]);
    // Dependencies của useCallback: đảm bảo hàm này được tạo lại chỉ khi các giá trị liên quan thay đổi

    return { checkGroundCollision };
};